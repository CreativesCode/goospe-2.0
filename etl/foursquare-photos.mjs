// Integra Foursquare Places API (la nueva, places-api.foursquare.com): por cada lugar lo busca
// por nombre+ubicación, valida el match por nombre+distancia, baja sus fotos y las sube al
// Storage de Supabase (bucket 'places'). Idempotente: salta lugares que ya tienen fotos foursquare.
//
// Requiere FOURSQUARE_API_KEY en .env.local.
// Uso:  node etl/foursquare-photos.mjs            (todos)
//       node etl/foursquare-photos.mjs --limit 10 (muestra)
//       node etl/foursquare-photos.mjs --per 3    (fotos por lugar, default 3)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createStorage } from './lib/storage.mjs'

const API = 'https://places-api.foursquare.com'
const VERSION = '2025-06-17'
const MATCH_RADIUS_M = 200
const PER_DEFAULT = 3
const CONCURRENCY = 4

const arg = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 ? Number(process.argv[i + 1]) : d }
const LIMIT = arg('--limit', null)
const PER = arg('--per', PER_DEFAULT)

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])
)
const KEY = env.FOURSQUARE_API_KEY
if (!KEY) { console.error('Falta FOURSQUARE_API_KEY en .env.local'); process.exit(1) }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const storage = createStorage(sb)

const H = { Authorization: `Bearer ${KEY}`, 'X-Places-Api-Version': VERSION, Accept: 'application/json' }
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3)

function nameMatches(ours, theirs) {
  const a = norm(ours), b = norm(theirs)
  if (a.includes(b) || b.includes(a)) return true
  const ta = new Set(tokens(ours)), tb = tokens(theirs)
  return tb.some((t) => ta.has(t))
}

async function fsq(path) {
  const res = await fetch(`${API}${path}`, { headers: H })
  if (!res.ok) throw new Error(`FSQ ${path} ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

async function findFsqId(place) {
  const q = encodeURIComponent(place.name)
  const data = await fsq(`/places/search?query=${q}&ll=${place.lat},${place.lng}&radius=${MATCH_RADIUS_M}&limit=5`)
  const results = data.results ?? []
  // mejor match: nombre coincide y la distancia más corta
  const matches = results.filter((r) => nameMatches(place.name, r.name)).sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
  return matches[0]?.fsq_place_id ?? null
}

async function getPhotos(fsqId) {
  const data = await fsq(`/places/${fsqId}/photos?limit=8&sort=POPULAR`)
  const arr = Array.isArray(data) ? data : data.photos ?? data.results ?? []
  return arr.map((p) => `${p.prefix}original${p.suffix}`).filter(Boolean)
}

async function pool(items, n, fn) {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]) } catch (e) { out[idx] = { err: e.message, name: items[idx].name }; console.error(`  ✗ ${items[idx].name}: ${e.message}`) } }
  }))
  return out
}

async function main() {
  let qy = sb.from('places').select('id, name').order('name')
  if (LIMIT) qy = qy.limit(LIMIT)
  const { data: places, error } = await qy
  if (error) throw error

  const { data: coords } = await sb.rpc('places_lnglat', { ids: places.map((p) => p.id) })
  const cmap = Object.fromEntries((coords ?? []).map((c) => [c.id, c]))

  // idempotencia: lugares que ya tienen foto foursquare
  const { data: have } = await sb.from('place_photos').select('place_id').eq('source', 'foursquare')
  const done = new Set((have ?? []).map((r) => r.place_id))

  const todo = places.map((p) => ({ ...p, ...cmap[p.id] })).filter((p) => p.lat != null && !done.has(p.id))
  console.log(`> Foursquare: ${todo.length} lugares a procesar (${done.size} ya tenían foto FSQ) · ${PER} fotos/lugar\n`)

  let matched = 0, photos = 0, bytes = 0
  const res = await pool(todo, CONCURRENCY, async (p) => {
    const fsqId = await findFsqId(p)
    if (!fsqId) return { name: p.name, matched: false }
    const urls = (await getPhotos(fsqId)).slice(0, PER)
    const rows = []
    for (const url of urls) {
      const up = await storage.uploadFromUrl(url, p.id, 'foursquare')
      rows.push({ place_id: p.id, url: up.publicUrl, storage_path: up.path, source: 'foursquare', status: 'approved' })
      bytes += up.bytes
    }
    if (rows.length) { const { error: e } = await sb.from('place_photos').insert(rows); if (e) throw e }
    return { name: p.name, matched: true, n: rows.length }
  })

  for (const r of res) { if (r && r.matched) { matched++; photos += r.n ?? 0 } }
  console.log('\n===== RESULTADO =====')
  console.log(`Lugares con match Foursquare: ${matched}/${todo.length}`)
  console.log(`Fotos subidas a Storage:      ${photos}  (${(bytes / 1e6).toFixed(1)} MB)`)
  console.log('\nMuestra:')
  for (const r of res.filter((x) => x && x.matched && x.n).slice(0, 10)) console.log(`  · ${r.name} — ${r.n} fotos`)
  const noMatch = res.filter((x) => x && x.matched === false).map((x) => x.name)
  if (noMatch.length) console.log(`\nSin match FSQ (${noMatch.length}): ${noMatch.slice(0, 15).join(', ')}${noMatch.length > 15 ? '…' : ''}`)
}

main().catch((e) => { console.error('foursquare falló:', e.message); process.exit(1) })
