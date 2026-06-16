// Probe de cobertura de fotos Mapillary para los lugares de la ciudad piloto.
// Mide cuántos de los 218 tienen imagen de fachada cercana (licencia abierta CC-BY-SA).
// NO inserta nada por defecto: solo reporta. Con --save guarda la mejor candidata en place_photos.
//
// Requiere MAPILLARY_TOKEN en .env.local (token gratis de mapillary.com → Developers).
// Uso:  node etl/probe-mapillary.mjs            (solo reporta cobertura)
//       node etl/probe-mapillary.mjs --save     (además inserta la foto más cercana por lugar)
//       node etl/probe-mapillary.mjs --limit 20 (muestra)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createStorage } from './lib/storage.mjs'

const RADIUS_M = 60          // imagen "cercana" al lugar
const CONCURRENCY = 6
const SAVE = process.argv.includes('--save')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])
)
const TOKEN = env.MAPILLARY_TOKEN
if (!TOKEN) { console.error('Falta MAPILLARY_TOKEN en .env.local (token gratis de mapillary.com → Developers).'); process.exit(1) }

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const storage = createStorage(sb)

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Mapillary devuelve geometry GeoJSON [lng,lat]; pedimos thumb 1024.
async function nearestImage(lat, lng) {
  const dLat = RADIUS_M / 111320
  const dLng = RADIUS_M / (111320 * Math.cos((lat * Math.PI) / 180))
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(',')
  const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(TOKEN)}` +
    `&fields=id,geometry,thumb_1024_url,captured_at&bbox=${bbox}&limit=50`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapillary ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  let best = null
  for (const img of json.data ?? []) {
    const [ilng, ilat] = img.geometry?.coordinates ?? []
    if (ilat == null) continue
    const d = haversine(lat, lng, ilat, ilng)
    if (d <= RADIUS_M && (!best || d < best.dist)) best = { id: img.id, url: img.thumb_1024_url, dist: d, captured_at: img.captured_at }
  }
  return best
}

async function pool(items, n, fn) {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++
      try { out[idx] = await fn(items[idx]) }
      catch (e) { out[idx] = { err: e.message }; console.error(`  ✗ ${items[idx].name}: ${e.message}`) }
    }
  }))
  return out
}

async function main() {
  let q = sb.from('places').select('id, name').order('name')
  if (LIMIT) q = q.limit(LIMIT)
  const { data: places, error } = await q
  if (error) throw error

  console.log(`> Probando cobertura Mapillary para ${places.length} lugares (radio ${RADIUS_M}m)${SAVE ? ' [SAVE]' : ''}\n`)

  const coords = await getCoords(places.map((p) => p.id))
  const withCoord = places.map((p) => ({ ...p, ...coords[p.id] })).filter((p) => p.lat != null)

  const res = await pool(withCoord, CONCURRENCY, async (p) => {
    const img = await nearestImage(p.lat, p.lng)
    return { place: p, img }
  })

  const found = res.filter((r) => r && r.img)
  console.log('===== COBERTURA MAPILLARY =====')
  console.log(`Con imagen cercana (≤${RADIUS_M}m): ${found.length}/${withCoord.length} (${Math.round((100 * found.length) / withCoord.length)}%)`)
  console.log('\nMuestra:')
  for (const r of found.slice(0, 8)) console.log(`  · ${r.place.name} — ${Math.round(r.img.dist)}m — ${r.img.url ? 'thumb ok' : 'sin thumb'}`)

  if (SAVE) {
    // Descarga la mejor candidata al Storage (no hotlink: las URLs de Mapillary caducan).
    let saved = 0, bytes = 0
    const cands = found.filter((r) => r.img.url)
    await pool(cands, CONCURRENCY, async (r) => {
      const up = await storage.uploadFromUrl(r.img.url, r.place.id, 'mapillary')
      const { error: e } = await sb.from('place_photos').insert({
        place_id: r.place.id, url: up.publicUrl, storage_path: up.path,
        source: 'mapillary', status: 'pending', // pending: fachada street-level, requiere revisión
      })
      if (e) throw e
      saved++; bytes += up.bytes
    })
    console.log(`\n> Guardadas ${saved} fotos en Storage (bucket 'places', ${(bytes / 1e6).toFixed(1)} MB, status=pending).`)
  } else {
    console.log('\n(Solo reporte. Corre con --save para descargar las candidatas al Storage como pending.)')
  }
}

// lat/lng desde places.location (geography) vía el RPC places_lnglat (migración 0010).
async function getCoords(ids) {
  const { data, error } = await sb.rpc('places_lnglat', { ids })
  if (error) throw new Error(`Falta el RPC places_lnglat. ${error.message}`)
  const map = {}
  for (const r of data) map[r.id] = { lat: r.lat, lng: r.lng }
  return map
}

main().catch((e) => { console.error('Probe falló:', e.message); process.exit(1) })
