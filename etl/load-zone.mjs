// CLI del agente / skill /load-zone: carga una zona de punta a punta SIN la vista admin.
// Resuelve la ciudad en Nominatim, crea el region_job y corre el mismo pipeline (pipeline.mjs).
// Comparte núcleo y tabla region_jobs con la vista admin (sin duplicar lógica de carga).
//
// Uso:  node etl/load-zone.mjs --country CL --region "Los Lagos" --city "Frutillar" [--index 0]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { loadEnv, makeServiceClient } from './lib/env.mjs'
import { runZoneLoad } from './lib/pipeline.mjs'

const arg = (flag, def = null) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : def
}

const __dir = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const tzlookup = require('tz-lookup')

// ISO2 → nombre de país (los 249, generado por scripts/gen-geo-catalog.cjs).
const COUNTRY_NAMES = JSON.parse(readFileSync(join(__dir, 'data/countries.json'), 'utf8'))

const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

async function nominatim(city, region, countryName, countryCode) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('city', city)
  url.searchParams.set('state', region)
  url.searchParams.set('countrycodes', countryCode.toLowerCase())
  url.searchParams.set('country', countryName)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')
  const res = await fetch(url, {
    headers: { 'User-Agent': 'goospe-loader-cli/0.1 (contact: titanicfactorymedia@gmail.com)' },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  return res.json()
}

async function main() {
  const countryCode = (arg('--country') || '').toUpperCase()
  const region = arg('--region')
  const city = arg('--city')
  const index = Number(arg('--index', '0'))
  if (!countryCode || !region || !city) {
    console.error('Uso: node etl/load-zone.mjs --country <ISO2> --region "<región>" --city "<ciudad>" [--index N]')
    process.exit(1)
  }
  const countryName = COUNTRY_NAMES[countryCode]
  if (!countryName) {
    console.error(`País ${countryCode} no está en el catálogo del CLI (añádelo a COUNTRY_NAMES).`)
    process.exit(1)
  }

  const env = loadEnv()
  const sb = makeServiceClient(env)

  const rows = await nominatim(city, region, countryName, countryCode)
  if (!rows.length) { console.error('Nominatim: sin resultados para esa ciudad/región.'); process.exit(1) }
  console.log('Candidatos Nominatim:')
  rows.forEach((r, i) => console.log(`  [${i}] ${r.name || r.display_name.split(',')[0]} — ${r.addresstype || r.type} — ${r.display_name}`))
  const r = rows[index]
  if (!r) { console.error(`Índice ${index} fuera de rango (hay ${rows.length}).`); process.exit(1) }

  const [s, n, w, e] = r.boundingbox.map(Number) // nominatim: [sur, norte, oeste, este]
  const lat = Number(r.lat), lng = Number(r.lon)
  let timezone = 'UTC'
  try { timezone = tzlookup(lat, lng) || 'UTC' } catch { /* deja UTC */ }
  const zone = {
    bbox: [s, w, n, e],
    center: { lat, lng },
    slug: `${slugify(city)}-${countryCode.toLowerCase()}`,
    timezone,
  }
  console.log(`\n> Zona [${index}]: ${r.display_name}`)
  console.log(`  bbox=${JSON.stringify(zone.bbox)} center=${JSON.stringify(zone.center)} slug=${zone.slug}`)

  const { data, error } = await sb
    .from('region_jobs')
    .insert({ country: countryName, region, city_name: city, bbox: zone, status: 'queued' })
    .select('id')
    .single()
  if (error) throw error
  console.log(`> region_jobs ${data.id} creado. Corriendo pipeline…\n`)

  await runZoneLoad(data.id)
  console.log('\n✓ Zona cargada y activada.')
}

main().catch((e) => { console.error('load-zone falló:', e.message); process.exit(1) })
