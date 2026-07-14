// Google Places (New) — fotos REALES del local, mostrar en vivo (no almacenar, por ToS).
// Por cada lugar: Text Search → toma las referencias de foto (resource names) y las guarda
// en place_photos como URL a nuestro proxy /api/place-photo (la key queda server-side).
// NO descarga bytes ni usa Storage. Idempotente (salta los que ya tienen foto google).
//
// Requiere: GOOGLE_MAPS_API_KEY en .env.local, con Places API (New) habilitada y SIN
//           restricción de referrer (para uso server-side).
// Uso:  node etl/google-photos.mjs            (todos)
//       node etl/google-photos.mjs --limit 10 (muestra)
//       node etl/google-photos.mjs --per 3    (fotos por lugar, default 3)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SEARCH_RADIUS_M = 250
const CONCURRENCY = 5
const arg = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 ? Number(process.argv[i + 1]) : d }
const LIMIT = arg('--limit', null)
const PER = arg('--per', 3)

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])
)
const KEY = env.GOOGLE_MAPS_API_KEY
if (!KEY) { console.error('Falta GOOGLE_MAPS_API_KEY en .env.local'); process.exit(1) }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const nameMatches = (a, b) => { const x = norm(a), y = norm(b); return x.includes(y) || y.includes(x) || norm(a).split(/\W+/).some((t) => t.length >= 3 && y.includes(t)) }

async function searchPlace(place) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: place.name,
      locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: SEARCH_RADIUS_M } },
      maxResultCount: 3,
    }),
  })
  if (!res.ok) throw new Error(`searchText ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const cand = (data.places ?? []).find((p) => nameMatches(place.name, p.displayName?.text ?? ''))
  return { photos: cand?.photos ?? [], businessStatus: cand?.businessStatus ?? null }
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
  const { data: have } = await sb.from('place_photos').select('place_id').eq('source', 'google')
  const done = new Set((have ?? []).map((r) => r.place_id))

  const todo = places.map((p) => ({ ...p, ...cmap[p.id] })).filter((p) => p.lat != null && !done.has(p.id))
  console.log(`> Google Places: ${todo.length} lugares (${done.size} ya tenían foto google) · hasta ${PER} fotos/lugar\n`)

  let matched = 0, photos = 0
  const res = await pool(todo, CONCURRENCY, async (p) => {
    const { photos: allRefs, businessStatus } = await searchPlace(p)
    // Estado autoritativo de Google — se guarda aunque no haya fotos (señal de "¿sigue abierto?").
    if (businessStatus) await sb.from('places').update({ business_status: businessStatus }).eq('id', p.id)
    const refs = allRefs.slice(0, PER)
    if (!refs.length) return { name: p.name, matched: false }
    const rows = refs.map((ph) => ({
      place_id: p.id,
      url: `/api/place-photo?name=${encodeURIComponent(ph.name)}&w=800`,
      source: 'google',
      status: 'approved', // fotos reales del local
    }))
    const { error: e } = await sb.from('place_photos').insert(rows)
    if (e) throw e
    return { name: p.name, matched: true, n: rows.length }
  })

  for (const r of res) { if (r && r.matched) { matched++; photos += r.n ?? 0 } }
  console.log('\n===== RESULTADO =====')
  console.log(`Lugares con foto Google: ${matched}/${todo.length}`)
  console.log(`Referencias guardadas:   ${photos}`)
  console.log('\nMuestra:')
  for (const r of res.filter((x) => x && x.matched).slice(0, 10)) console.log(`  · ${r.name} — ${r.n} fotos`)
  const noMatch = res.filter((x) => x && x.matched === false).map((x) => x.name)
  if (noMatch.length) console.log(`\nSin foto (${noMatch.length}): ${noMatch.slice(0, 15).join(', ')}${noMatch.length > 15 ? '…' : ''}`)
}

main().catch((e) => { console.error('google-photos falló:', e.message); process.exit(1) })
