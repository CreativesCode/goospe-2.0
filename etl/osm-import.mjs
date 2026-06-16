// ETL determinista OSM → places (Fase 1, doc 04 §5.1 / doc 06).
// Extrae POIs de la vertical (comida/café/bares/nightlife) del bbox de la ciudad piloto,
// dedup (nombre normalizado + <50m), mapea tags OSM→categoría, parsea SOLO lo estructurado
// (nada que ya venga estructurado pasa por LLM) e inserta con service_role.
// Enriquecimiento IA (descripción, vibe_line, embedding) NO se hace aquí: queda ai_enriched_at=null.
//
// Uso:  node etl/osm-import.mjs            (inserta)
//       node etl/osm-import.mjs --dry-run  (solo reporta, no inserta)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ---------- config ciudad piloto: Puerto Varas ----------
const CITY_ID = 1
const CITY_SLUG = 'puerto-varas'
// Zona piloto = corredor lacustre oeste del lago Llanquihue:
// Puerto Varas → Llanquihue → Frutillar (ciudades turísticas contiguas del mismo lago).
// Puerto Montt queda excluido por latitud (está al sur de -41.37).
// bbox [sur, oeste, norte, este]
const BBOX = [-41.365, -73.080, -41.095, -72.930]
const DEDUPE_METERS = 50
const DRY_RUN = process.argv.includes('--dry-run')

// ---------- cargar env desde .env.local ----------
function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ---------- helpers ----------
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const normName = (s) => stripAccents(String(s).toLowerCase()).replace(/\s+/g, ' ').trim()
const slugify = (s) =>
  stripAccents(String(s).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function osmTagOf(tags) {
  if (tags.amenity) return `amenity=${tags.amenity}`
  if (tags.shop) return `shop=${tags.shop}`
  return null
}

function parseAddress(tags) {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  const city = tags['addr:city'] ?? tags['addr:place'] ?? null
  if (!street && !number && !city) return null
  const formatted = [street, number].filter(Boolean).join(' ') || city || null
  return { street: street ?? null, number: number ?? null, city, formatted }
}

function parseTags(tags) {
  // cuisine=italian;pizza → ['italian','pizza']  (determinista, sin LLM)
  const out = []
  if (tags.cuisine) out.push(...tags.cuisine.split(';').map((t) => t.trim()).filter(Boolean))
  if (tags.diet_vegetarian === 'yes') out.push('vegetariano')
  if (tags.diet_vegan === 'yes') out.push('vegano')
  if (tags.outdoor_seating === 'yes') out.push('terraza')
  return [...new Set(out)]
}

const firstOf = (tags, keys) => keys.map((k) => tags[k]).find(Boolean) ?? null

// ---------- 1) Overpass ----------
async function fetchOverpass() {
  const amenities = 'restaurant|fast_food|cafe|bar|pub|biergarten|nightclub|ice_cream|food_court'
  const shops = 'bakery|pastry'
  const [s, w, n, e] = BBOX
  const bb = `(${s},${w},${n},${e})`
  const ql = `[out:json][timeout:90];
(
  node["amenity"~"^(${amenities})$"]${bb};
  way["amenity"~"^(${amenities})$"]${bb};
  node["shop"~"^(${shops})$"]${bb};
  way["shop"~"^(${shops})$"]${bb};
);
out center tags;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'goospe-etl/0.1 (Puerto Varas pilot; contact: titanicfactorymedia@gmail.com)',
    },
    body: 'data=' + encodeURIComponent(ql),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.elements ?? []
}

// ---------- main ----------
async function main() {
  console.log(`> Ciudad: ${CITY_SLUG} (id ${CITY_ID})  bbox ${BBOX.join(', ')}  ${DRY_RUN ? '[DRY-RUN]' : ''}`)

  const { data: mappings, error: mErr } = await supabase
    .from('category_mappings')
    .select('osm_tag, category_id')
  if (mErr) throw mErr
  const tagToCat = new Map(mappings.map((m) => [m.osm_tag, m.category_id]))
  const { data: cats } = await supabase.from('categories').select('id, slug')
  const catSlug = new Map(cats.map((c) => [c.id, c.slug]))

  const elements = await fetchOverpass()
  console.log(`> Overpass devolvió ${elements.length} elementos`)

  let noName = 0
  let noCat = 0
  const accepted = []
  for (const el of elements) {
    const tags = el.tags ?? {}
    const name = tags.name
    if (!name) { noName++; continue }
    const osmTag = osmTagOf(tags)
    const categoryId = osmTag ? tagToCat.get(osmTag) : null
    if (!categoryId) { noCat++; continue }

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    // dedup: mismo nombre normalizado a <50m de uno ya aceptado
    const nn = normName(name)
    const dup = accepted.find((a) => a.nn === nn && haversine(a.lat, a.lng, lat, lng) < DEDUPE_METERS)
    if (dup) continue

    accepted.push({
      nn, lat, lng, name, categoryId,
      osmId: `${el.type}/${el.id}`,
      record: {
        slug: `${slugify(name)}-${el.type[0]}${el.id}`,
        name,
        city_id: CITY_ID,
        location: `SRID=4326;POINT(${lng} ${lat})`,
        address: parseAddress(tags),
        phone: firstOf(tags, ['phone', 'contact:phone']),
        whatsapp: firstOf(tags, ['contact:whatsapp']),
        website: firstOf(tags, ['website', 'contact:website']),
        instagram: firstOf(tags, ['contact:instagram']),
        email: firstOf(tags, ['email', 'contact:email']),
        hours: tags.opening_hours ? { osm_raw: tags.opening_hours } : null,
        tags: parseTags(tags),
        source: 'osm',
        is_published: true,
      },
    })
  }

  // ---------- reporte por categoría ----------
  const byCat = {}
  for (const a of accepted) {
    const slug = catSlug.get(a.categoryId) ?? '??'
    byCat[slug] = (byCat[slug] ?? 0) + 1
  }
  console.log('\n===== RESULTADO =====')
  console.log(`Sin nombre (descartados):     ${noName}`)
  console.log(`Sin categoría mapeada:        ${noCat}`)
  console.log(`Únicos tras dedup (<${DEDUPE_METERS}m):    ${accepted.length}`)
  console.log('Por categoría:')
  for (const [slug, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(10)} ${n}`)
  }
  const withPhone = accepted.filter((a) => a.record.phone).length
  const withWeb = accepted.filter((a) => a.record.website).length
  const withHours = accepted.filter((a) => a.record.hours).length
  console.log('Calidad de datos OSM:')
  console.log(`  con teléfono: ${withPhone} (${pct(withPhone, accepted.length)})`)
  console.log(`  con web:      ${withWeb} (${pct(withWeb, accepted.length)})`)
  console.log(`  con horario:  ${withHours} (${pct(withHours, accepted.length)})`)

  if (DRY_RUN) { console.log('\n[DRY-RUN] no se insertó nada.'); return }

  // ---------- inserción ----------
  const rows = accepted.map((a) => a.record)
  const { data: inserted, error: insErr } = await supabase
    .from('places')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: true })
    .select('id, slug')
  if (insErr) throw insErr
  const slugToId = new Map((inserted ?? []).map((r) => [r.slug, r.id]))
  console.log(`\n> Insertados en places: ${inserted?.length ?? 0} (los ya existentes se omiten)`)

  // place_categories solo para los recién insertados
  const pc = []
  for (const a of accepted) {
    const id = slugToId.get(a.record.slug)
    if (id) pc.push({ place_id: id, category_id: a.categoryId })
  }
  if (pc.length) {
    const { error: pcErr } = await supabase
      .from('place_categories')
      .upsert(pc, { onConflict: 'place_id,category_id', ignoreDuplicates: true })
    if (pcErr) throw pcErr
    console.log(`> Vínculos place_categories: ${pc.length}`)
  }
  console.log('\n✓ ETL completo. Enriquecimiento IA pendiente (ai_enriched_at = null).')
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '0%')

main().catch((e) => { console.error('ETL falló:', e.message); process.exit(1) })
