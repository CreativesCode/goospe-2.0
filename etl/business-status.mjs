// Backfill del estado de negocio (Google Places businessStatus) sobre lugares YA cargados.
// Por cada lugar: Text Search en Google (match por nombre + cercanía) → guarda business_status
// en places (OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY). Los cerrados definitivos
// dejan de aparecer en el feed/búsqueda/conserje (ver migración 0030).
//
// Reusa la MISMA llamada que ya hace la carga de fotos (searchText), así que no añade un tier de
// coste nuevo: businessStatus viaja en el mismo SKU "Pro" que las fotos.
//
// Requiere: GOOGLE_MAPS_API_KEY + Supabase service-role en .env.local. GASTA (una búsqueda por lugar).
//
// Uso:
//   node etl/business-status.mjs                 # rellena solo los que aún no tienen dato (NULL)
//   node etl/business-status.mjs --all           # re-consulta TODOS (detecta cierres nuevos)
//   node etl/business-status.mjs --city madrid   # limita a una ciudad (por slug)
//   node etl/business-status.mjs --limit 50      # muestra / prueba
//   node etl/business-status.mjs --dry           # no escribe, solo reporta lo que haría

import { loadEnv, makeServiceClient, pool } from './lib/env.mjs'

const SEARCH_RADIUS_M = 250
const CONCURRENCY = 5
const has = (f) => process.argv.includes(f)
const arg = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 ? process.argv[i + 1] : d }

const ALL = has('--all')
const DRY = has('--dry')
const CITY = arg('--city', null)
const LIMIT = arg('--limit', null) ? Number(arg('--limit', null)) : null

const env = loadEnv()
const KEY = env.GOOGLE_MAPS_API_KEY
if (!KEY) { console.error('Falta GOOGLE_MAPS_API_KEY en .env.local'); process.exit(1) }
const sb = makeServiceClient(env)

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const nameMatches = (a, b) => {
  const x = norm(a), y = norm(b)
  return x.includes(y) || y.includes(x) || x.split(/\W+/).some((t) => t.length >= 3 && y.includes(t))
}

async function statusFromGoogle(place) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.businessStatus',
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
  return cand?.businessStatus ?? null
}

async function main() {
  // Resuelve city_id si se filtró por slug.
  let cityId = null
  if (CITY) {
    const { data: city } = await sb.from('cities').select('id, name').eq('slug', CITY).maybeSingle()
    if (!city) { console.error(`No existe ciudad con slug "${CITY}"`); process.exit(1) }
    cityId = city.id
    console.log(`> Ciudad: ${city.name} (slug ${CITY})`)
  }

  let qy = sb.from('places').select('id, name, city_id').order('name')
  if (cityId) qy = qy.eq('city_id', cityId)
  if (!ALL) qy = qy.is('business_status', null) // por defecto solo los que aún no tienen dato
  if (LIMIT) qy = qy.limit(LIMIT)
  const { data: places, error } = await qy
  if (error) throw error
  if (!places.length) { console.log('Nada que procesar (¿ya tienen business_status? usa --all para refrescar).'); return }

  // Coords lat/lng (RPC places_lnglat, migración 0010).
  const { data: coords, error: cErr } = await sb.rpc('places_lnglat', { ids: places.map((p) => p.id) })
  // Blindaje: si la RPC falla o vuelve vacía, NO seguir en silencio (antes se veía como "0 lugares").
  if (cErr) throw new Error(`places_lnglat: ${cErr.message}`)
  if (!coords?.length) throw new Error(`places_lnglat devolvió 0 coords para ${places.length} lugares — reintenta`)
  const cmap = Object.fromEntries(coords.map((c) => [c.id, c]))
  const todo = places.map((p) => ({ ...p, ...cmap[p.id] })).filter((p) => p.lat != null)
  const sinCoords = places.length - todo.length
  if (sinCoords > 0) console.log(`  (${sinCoords} lugares sin coordenadas, se omiten)`)

  console.log(`> business-status: ${todo.length} lugares${ALL ? ' (refresco completo)' : ' (solo sin dato)'}${DRY ? ' · DRY-RUN' : ''}\n`)

  const tally = { OPERATIONAL: 0, CLOSED_TEMPORARILY: 0, CLOSED_PERMANENTLY: 0, SIN_MATCH: 0 }
  const closedNames = []
  let updated = 0

  const res = await pool(todo, CONCURRENCY, async (p) => {
    const status = await statusFromGoogle(p)
    if (!status) { tally.SIN_MATCH++; return { name: p.name, status: null } }
    tally[status] = (tally[status] ?? 0) + 1
    if (status === 'CLOSED_PERMANENTLY') closedNames.push(p.name)
    if (!DRY) {
      const { error: e } = await sb.from('places').update({ business_status: status }).eq('id', p.id)
      if (e) throw e
      updated++
    }
    return { name: p.name, status }
  })

  const errors = res.filter((r) => r && r.__error)

  console.log('\n===== RESULTADO =====')
  console.log(`Operativos:            ${tally.OPERATIONAL}`)
  console.log(`Cerrados temporal:     ${tally.CLOSED_TEMPORARILY}`)
  console.log(`Cerrados definitivo:   ${tally.CLOSED_PERMANENTLY}`)
  console.log(`Sin match en Google:   ${tally.SIN_MATCH}`)
  console.log(`${DRY ? 'Se actualizarían' : 'Actualizados'}:        ${DRY ? todo.length - tally.SIN_MATCH : updated}`)
  if (errors.length) console.log(`Errores:               ${errors.length}`)
  if (closedNames.length) {
    console.log(`\nCerrados definitivos (${closedNames.length}) — ya no aparecerán en el feed:`)
    for (const n of closedNames.slice(0, 30)) console.log(`  · ${n}`)
    if (closedNames.length > 30) console.log(`  … y ${closedNames.length - 30} más`)
  }
}

main().catch((e) => { console.error('business-status falló:', e.message); process.exit(1) })
