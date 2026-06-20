// Núcleo del cargador de zonas. Parametrizable por ciudad y reusado por la vista admin
// (vía run-zone.mjs) y por el skill /load-zone. Reporta progreso a region_jobs.
//
// Etapas: ensureCity → importOsm → fotos Google → enriquecimiento IA (anclas) → Mapillary
// (fallback) → activar ciudad.

import { loadEnv, makeServiceClient, pool } from './env.mjs'
import { fetchOverpass, buildPlaceRecords, loadCategoryMaps, haversine } from './osm.mjs'
import { createAI, costUSD } from './ai.mjs'
import { createStorage } from './storage.mjs'
import { getJob, makeReporter } from './jobs.mjs'

const ANCHOR_LIMIT_DEFAULT = 60
const GOOGLE_PER = 3
const MAPILLARY_RADIUS_M = 60

const toVectorLiteral = (arr) => `[${arr.join(',')}]`
const dedupTags = (...lists) =>
  [...new Set(lists.flat().filter(Boolean).map((t) => String(t).toLowerCase().trim()))].slice(0, 10)

// Coords lat/lng de places (RPC places_lnglat, migración 0010).
async function coordsOf(sb, ids) {
  if (!ids.length) return {}
  const { data, error } = await sb.rpc('places_lnglat', { ids })
  if (error) throw new Error(`places_lnglat: ${error.message}`)
  return Object.fromEntries((data ?? []).map((c) => [c.id, c]))
}

// Normaliza el campo bbox del job: acepta [s,w,n,e] o { bbox, center, timezone, coverageRadiusM }.
export function normalizeZone(raw) {
  const z = Array.isArray(raw) ? { bbox: raw } : raw ?? {}
  const bbox = z.bbox
  if (!Array.isArray(bbox) || bbox.length !== 4) throw new Error('Zona sin bbox [s,w,n,e] válido')
  const [s, w, n, e] = bbox.map(Number)
  const center = z.center ?? { lat: (s + n) / 2, lng: (w + e) / 2 }
  // Radio que cubre el bbox: del centro a la esquina (con 10% de margen).
  const coverageRadiusM = z.coverageRadiusM ?? Math.round(haversine(center.lat, center.lng, n, e) * 1.1)
  return { bbox: [s, w, n, e], center, timezone: z.timezone ?? 'UTC', coverageRadiusM, slug: z.slug ?? null }
}

// Crea (o reusa por slug) la ciudad; devuelve su id. Nace is_active=false.
export async function ensureCity(sb, { country, region, cityName, slug, center, timezone, coverageRadiusM }) {
  const { data: existing } = await sb.from('cities').select('id').eq('slug', slug).maybeSingle()
  if (existing) return existing.id
  const { data, error } = await sb
    .from('cities')
    .insert({
      name: cityName,
      slug,
      country,
      region,
      center: `SRID=4326;POINT(${center.lng} ${center.lat})`,
      timezone: timezone || 'UTC',
      coverage_radius_m: coverageRadiusM ?? 25000,
      is_active: false,
    })
    .select('id')
    .single()
  if (error) throw new Error(`ensureCity: ${error.message}`)
  return data.id
}

// OSM → places para la ciudad (idempotente: upsert por slug).
export async function importOsm(sb, { cityId, bbox }) {
  const { tagToCat } = await loadCategoryMaps(sb)
  const elements = await fetchOverpass(bbox)
  const { records } = buildPlaceRecords(elements, { cityId, tagToCat })
  const { data: inserted, error } = await sb
    .from('places')
    .upsert(records.map((r) => r.record), { onConflict: 'slug', ignoreDuplicates: true })
    .select('id, slug')
  if (error) throw new Error(`import upsert: ${error.message}`)
  const slugToId = new Map((inserted ?? []).map((r) => [r.slug, r.id]))
  const pc = []
  for (const r of records) {
    const id = slugToId.get(r.record.slug)
    if (id) pc.push({ place_id: id, category_id: r.categoryId })
  }
  if (pc.length) {
    await sb.from('place_categories').upsert(pc, { onConflict: 'place_id,category_id', ignoreDuplicates: true })
  }
  return { osm: elements.length, candidates: records.length, inserted: inserted?.length ?? 0 }
}

// Fotos Google Places (mostrar, no almacenar) para la ciudad. Idempotente.
export async function photosGoogle(sb, { cityId, key, per = GOOGLE_PER, onProgress }) {
  if (!key) return { matched: 0, photos: 0, skipped: 'sin GOOGLE_MAPS_API_KEY' }
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const nameMatches = (a, b) => {
    const x = norm(a), y = norm(b)
    return x.includes(y) || y.includes(x) || x.split(/\W+/).some((t) => t.length >= 3 && y.includes(t))
  }

  const { data: places } = await sb.from('places').select('id, name').eq('city_id', cityId).order('name')
  const cmap = await coordsOf(sb, (places ?? []).map((p) => p.id))
  const { data: have } = await sb.from('place_photos').select('place_id').eq('source', 'google')
  const done = new Set((have ?? []).map((r) => r.place_id))
  const todo = (places ?? []).map((p) => ({ ...p, ...cmap[p.id] })).filter((p) => p.lat != null && !done.has(p.id))

  let processed = 0
  let photos = 0
  let matched = 0
  const res = await pool(todo, 5, async (p) => {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
      },
      body: JSON.stringify({
        textQuery: p.name,
        locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 250 } },
        maxResultCount: 3,
      }),
    })
    if (!r.ok) throw new Error(`searchText ${r.status}`)
    const data = await r.json()
    const cand = (data.places ?? []).find((g) => nameMatches(p.name, g.displayName?.text ?? ''))
    const refs = (cand?.photos ?? []).slice(0, per)
    if (refs.length) {
      const rows = refs.map((ph) => ({
        place_id: p.id,
        url: `/api/place-photo?name=${encodeURIComponent(ph.name)}&w=800`,
        source: 'google',
        status: 'approved',
      }))
      const { error } = await sb.from('place_photos').insert(rows)
      if (error) throw error
      matched++
      photos += rows.length
    }
    processed++
    if (onProgress) onProgress(processed / Math.max(todo.length, 1))
    return null
  })
  void res
  return { matched, photos, todo: todo.length }
}

// Enriquecimiento IA por niveles: enriquece hasta `anchorLimit` lugares (prioriza los que ya
// tienen foto) como tier 'full'; el resto queda 'tail' (on-demand al primer view, futuro).
export async function enrichCity(sb, ai, { cityId, cityContext, anchorLimit = ANCHOR_LIMIT_DEFAULT, onProgress }) {
  const { data: pending } = await sb
    .from('places')
    .select('id, name, address, tags, place_categories(categories(slug,name))')
    .eq('city_id', cityId)
    .is('ai_enriched_at', null)
    .order('name')
  if (!pending?.length) return { enriched: 0, cost: 0, total: 0 }

  // Prioriza como anclas los que ya tienen alguna foto (más probables de ser reales/notables).
  const { data: photoRows } = await sb
    .from('place_photos')
    .select('place_id')
    .in('place_id', pending.map((p) => p.id))
  const withPhoto = new Set((photoRows ?? []).map((r) => r.place_id))
  const ordered = [...pending].sort((a, b) => Number(withPhoto.has(b.id)) - Number(withPhoto.has(a.id)))
  const anchors = ordered.slice(0, anchorLimit)

  let processed = 0
  let enriched = 0
  let cost = 0
  const res = await pool(anchors, 5, async (p) => {
    const category = p.place_categories?.[0]?.categories?.name ?? 'Lugar'
    const enr = await ai.enrichText({
      name: p.name,
      category,
      city: cityContext?.city ?? p.address?.city ?? null,
      region: cityContext?.region ?? null,
      country: cityContext?.country ?? null,
      address: p.address?.formatted ?? null,
      tags: p.tags,
    })
    const tags = dedupTags(p.tags, enr.tags)
    const embText = `${p.name}. ${category}. ${enr.vibe_line}. ${enr.description} Tags: ${tags.join(', ')}`
    const emb = await ai.embed(embText)

    const { error } = await sb.from('places').update({
      description: enr.description,
      vibe_line: enr.vibe_line,
      tags,
      price_level: enr.price_level,
      embedding: toVectorLiteral(emb.vector),
      embedding_model: emb.model,
      ai_enriched_at: new Date().toISOString(),
      enrich_tier: 'full',
    }).eq('id', p.id)
    if (error) throw error

    await sb.from('ai_usage').insert([
      { feature: 'enrich_text', model: enr.model, input_tokens: enr.usage.input, output_tokens: enr.usage.output,
        cost_usd: costUSD(enr.model, enr.usage.input, enr.usage.output) },
      { feature: 'enrich_embed', model: emb.model, input_tokens: emb.usage.tokens,
        cost_usd: costUSD(emb.model, emb.usage.tokens) },
    ])
    cost += costUSD(enr.model, enr.usage.input, enr.usage.output) + costUSD(emb.model, emb.usage.tokens)
    enriched++
    processed++
    if (onProgress) onProgress(processed / anchors.length)
    return null
  })
  void res
  return { enriched, cost, total: pending.length, tail: Math.max(0, pending.length - anchors.length) }
}

// Mapillary fallback: para los lugares de la ciudad SIN ninguna foto, descarga la fachada
// más cercana al Storage (status pending → moderación).
export async function photosMapillary(sb, storage, { cityId, token, onProgress }) {
  if (!token) return { saved: 0, skipped: 'sin MAPILLARY_TOKEN' }
  const { data: places } = await sb.from('places').select('id, name').eq('city_id', cityId)
  const { data: have } = await sb.from('place_photos').select('place_id')
  const done = new Set((have ?? []).map((r) => r.place_id))
  const todoPlaces = (places ?? []).filter((p) => !done.has(p.id))
  const cmap = await coordsOf(sb, todoPlaces.map((p) => p.id))
  const todo = todoPlaces.map((p) => ({ ...p, ...cmap[p.id] })).filter((p) => p.lat != null)

  let processed = 0
  let saved = 0
  const res = await pool(todo, 6, async (p) => {
    const dLat = MAPILLARY_RADIUS_M / 111320
    const dLng = MAPILLARY_RADIUS_M / (111320 * Math.cos((p.lat * Math.PI) / 180))
    const bbox = [p.lng - dLng, p.lat - dLat, p.lng + dLng, p.lat + dLat].join(',')
    const r = await fetch(
      `https://graph.mapillary.com/images?access_token=${encodeURIComponent(token)}` +
        `&fields=id,geometry,thumb_1024_url&bbox=${bbox}&limit=50`
    )
    if (!r.ok) throw new Error(`Mapillary ${r.status}`)
    const json = await r.json()
    let best = null
    for (const img of json.data ?? []) {
      const [ilng, ilat] = img.geometry?.coordinates ?? []
      if (ilat == null || !img.thumb_1024_url) continue
      const d = haversine(p.lat, p.lng, ilat, ilng)
      if (d <= MAPILLARY_RADIUS_M && (!best || d < best.d)) best = { url: img.thumb_1024_url, d }
    }
    if (best) {
      const up = await storage.uploadFromUrl(best.url, p.id, 'mapillary')
      const { error } = await sb.from('place_photos').insert({
        place_id: p.id, url: up.publicUrl, storage_path: up.path, source: 'mapillary', status: 'pending',
      })
      if (error) throw error
      saved++
    }
    processed++
    if (onProgress) onProgress(processed / Math.max(todo.length, 1))
    return null
  })
  void res
  return { saved, todo: todo.length }
}

// Orquesta la carga completa de una zona a partir de un region_jobs.id.
export async function runZoneLoad(jobId) {
  const env = loadEnv()
  const sb = makeServiceClient(env)
  const ai = createAI(env)
  const r = makeReporter(sb, jobId)

  try {
    const job = await getJob(sb, jobId)
    const { country, region } = job
    const cityName = job.city_name
    const zone = normalizeZone(job.bbox)
    await r.log(`Cargando zona: ${[cityName, region, country].filter(Boolean).join(', ')}`)

    // 1) Ciudad
    await r.stage('insert', 0.02)
    const slug = zone.slug || slugifyCity(cityName)
    const cityId =
      job.city_id ||
      (await ensureCity(sb, {
        country, region, cityName, slug,
        center: zone.center, timezone: zone.timezone, coverageRadiusM: zone.coverageRadiusM,
      }))
    await sb.from('region_jobs').update({ city_id: cityId }).eq('id', jobId)
    await r.log(`Ciudad #${cityId} (${slug}) · radio cobertura ${(zone.coverageRadiusM / 1000).toFixed(1)} km`)

    // 2) OSM
    await r.stage('osm', 0.05)
    const imp = await importOsm(sb, { cityId, bbox: zone.bbox })
    await r.counts({ osm: imp.osm, inserted: imp.inserted })
    await r.log(`OSM: ${imp.osm} elementos → ${imp.candidates} candidatos → ${imp.inserted} insertados`)

    // 2.5) Autocorrección de pertenencia: jala hacia esta ciudad los POIs vecinos que caen en su
    // bbox y le quedan más cerca que a cualquier otra ciudad activa (arregla el solape de comunas:
    // sin esto, "el primero que importa, gana" y la ciudad nueva nace casi vacía). Marca los
    // movidos para re-enriquecer (su texto mencionaba la ciudad vieja). [s,w,n,e]
    const [zs, zw, zn, ze] = zone.bbox
    const { data: pulled, error: pErr } = await sb.rpc('assign_nearest_city', {
      p_city_id: cityId, p_s: zs, p_w: zw, p_n: zn, p_e: ze,
    })
    if (pErr) await r.log(`Reasignación: omitida (${pErr.message})`)
    else if (pulled) {
      await r.counts({ reasignados: pulled })
      await r.log(`Reasignación: ${pulled} lugares vecinos jalados a esta zona (se re-enriquecen)`)
    }

    // 3) Fotos Google
    await r.stage('photos', 0.15)
    const gp = await photosGoogle(sb, { cityId, key: env.GOOGLE_MAPS_API_KEY, onProgress: (p) => r.progress(0.15 + 0.3 * p) })
    await r.counts({ photos_google: gp.photos ?? 0 })
    await r.log(`Fotos Google: ${gp.matched ?? 0} lugares, ${gp.photos ?? 0} fotos`)

    // 4) Enriquecimiento IA (anclas)
    await r.stage('enrich_anchors', 0.45)
    const en = await enrichCity(sb, ai, {
      cityId,
      cityContext: { city: cityName, region, country },
      anchorLimit: Number(env.ZONE_ANCHOR_LIMIT || ANCHOR_LIMIT_DEFAULT),
      onProgress: (p) => r.progress(0.45 + 0.4 * p),
    })
    await r.counts({ enriched: en.enriched, tail: en.tail ?? 0 })
    await r.log(`IA: ${en.enriched} anclas enriquecidas ($${en.cost.toFixed(3)}), ${en.tail ?? 0} en cola larga`)

    // 5) Mapillary fallback
    await r.stage('photos', 0.85)
    const storage = createStorage(sb)
    const mp = await photosMapillary(sb, storage, { cityId, token: env.MAPILLARY_TOKEN, onProgress: (p) => r.progress(0.85 + 0.1 * p) })
    await r.counts({ photos_mapillary: mp.saved ?? 0 })
    await r.log(`Mapillary: ${mp.saved ?? 0} fachadas (pending)`)

    // 6) Activar ciudad
    await r.stage('activate', 0.97)
    await sb.from('cities').update({ is_active: true }).eq('id', cityId)
    await r.log(`✓ Ciudad activada (is_active=true). Ya aparece en el feed de su zona.`)
    await r.done()
    return { cityId }
  } catch (e) {
    await r.fail(e.message)
    throw e
  }
}

function slugifyCity(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}
