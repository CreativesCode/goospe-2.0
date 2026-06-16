// Re-corre OSM para extraer lo que el import inicial no usó:
//  - fotos: tags `image` (URL directa) y `wikimedia_commons` (File:... → thumbnail Commons)
//  - backfill de Instagram: tags `instagram` / `contact:instagram` → places.instagram (si estaba null)
// Matchea con los places ya cargados reconstruyendo el mismo slug del import (name + osm id).
// Idempotente. Uso: node etl/osm-images.mjs

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BBOX = [-41.365, -73.080, -41.095, -72.930]

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const slugify = (s) => stripAccents(String(s).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function commonsThumb(val) {
  // "File:Foo.jpg" o "Foo.jpg" → Special:FilePath (redirige al archivo, con width)
  const file = val.replace(/^File:/i, '').trim()
  if (!file || /^Category:/i.test(val)) return null
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1024`
}

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
      Accept: 'application/json',
      'User-Agent': 'goospe-etl/0.1 (Puerto Varas pilot; contact: titanicfactorymedia@gmail.com)',
    },
    body: 'data=' + encodeURIComponent(ql),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  return (await res.json()).elements ?? []
}

async function main() {
  // índice de places por slug
  const { data: places, error } = await sb.from('places').select('id, slug, instagram')
  if (error) throw error
  const bySlug = new Map(places.map((p) => [p.slug, p]))
  const existingPhotos = new Set()
  {
    const { data: ph } = await sb.from('place_photos').select('place_id, url')
    for (const r of ph ?? []) existingPhotos.add(`${r.place_id}|${r.url}`)
  }

  const elements = await fetchOverpass()
  console.log(`> Overpass: ${elements.length} elementos · ${places.length} places en BD`)

  const photoRows = []
  const igUpdates = []
  let igInOsm = 0
  for (const el of elements) {
    const tags = el.tags ?? {}
    if (!tags.name) continue
    const slug = `${slugify(tags.name)}-${el.type[0]}${el.id}`
    const place = bySlug.get(slug)
    if (!place) continue

    // imágenes
    const imgs = []
    if (tags.image && /^https?:\/\//i.test(tags.image)) imgs.push(tags.image)
    if (tags.wikimedia_commons) { const u = commonsThumb(tags.wikimedia_commons); if (u) imgs.push(u) }
    for (const url of imgs) {
      if (!existingPhotos.has(`${place.id}|${url}`)) {
        photoRows.push({ place_id: place.id, url, status: 'pending' })
        existingPhotos.add(`${place.id}|${url}`)
      }
    }

    // instagram backfill
    const ig = tags.instagram || tags['contact:instagram']
    if (ig) {
      igInOsm++
      if (!place.instagram) igUpdates.push({ id: place.id, instagram: ig })
    }
  }

  if (photoRows.length) {
    const { error: e } = await sb.from('place_photos').insert(photoRows)
    if (e) throw e
  }
  for (const u of igUpdates) {
    await sb.from('places').update({ instagram: u.instagram }).eq('id', u.id)
  }

  const { count: totalIg } = await sb.from('places').select('*', { count: 'exact', head: true }).not('instagram', 'is', null)

  console.log('\n===== RESULTADO =====')
  console.log(`Fotos OSM (image/wikimedia) insertadas: ${photoRows.length}`)
  console.log(`Instagram en OSM (esta corrida):        ${igInOsm}`)
  console.log(`Instagram backfilled ahora:             ${igUpdates.length}`)
  console.log(`Places con handle de Instagram (total): ${totalIg}/${places.length}`)
}

main().catch((e) => { console.error('osm-images falló:', e.message); process.exit(1) })
