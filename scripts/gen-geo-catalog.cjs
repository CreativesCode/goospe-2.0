// Genera el catálogo país→regiones del cargador de zonas a partir de `country-region-data`
// (ISO 3166-1/3166-2). Nombres de país en español vía Intl.DisplayNames; regiones con su nombre
// oficial (Nominatim los matchea por `state`). Emite:
//   - src/features/loader/data/geo-catalog.ts   (UI ZonePicker + server action)
//   - etl/data/countries.json                   (CLI etl/load-zone.mjs: code→nombre español)
// Re-ejecutar:  node scripts/gen-geo-catalog.cjs
const fs = require('node:fs')
const path = require('node:path')
const data = require('country-region-data')

const esName = new Intl.DisplayNames(['es'], { type: 'region' })
const root = path.resolve(__dirname, '..')

// allCountries: [ [countryName, ISO2, [[regionName, regionShortCode], ...]], ... ]
const countries = data.allCountries
  .map(([, code, regions]) => ({
    code,
    name: (() => { try { return esName.of(code) || code } catch { return code } })(),
    regions: (regions || []).map(([rName]) => rName),
  }))
  .filter((c) => /^[A-Z]{2}$/.test(c.code))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

const tsHeader = `// AUTO-GENERADO por scripts/gen-geo-catalog.cjs — NO editar a mano.
// Fuente: country-region-data (ISO 3166). Nombres de país en español (Intl.DisplayNames).
// Las CIUDADES NO se listan aquí (se resuelven vía Nominatim, devolviendo bbox).
// La timezone de cada ciudad se deriva de sus coordenadas con tz-lookup al cargarla.
// Regenerar:  node scripts/gen-geo-catalog.cjs

export type Country = { code: string; name: string; regions: string[] }

export const COUNTRIES: Country[] = `
const ts = tsHeader + JSON.stringify(countries, null, 2) + `

export const countryByCode = (code: string): Country | undefined =>
  COUNTRIES.find((c) => c.code === code)
`

fs.writeFileSync(path.join(root, 'src/features/loader/data/geo-catalog.ts'), ts, 'utf8')

const codeToName = Object.fromEntries(countries.map((c) => [c.code, c.name]))
fs.mkdirSync(path.join(root, 'etl/data'), { recursive: true })
fs.writeFileSync(path.join(root, 'etl/data/countries.json'), JSON.stringify(codeToName, null, 0), 'utf8')

const totalRegions = countries.reduce((n, c) => n + c.regions.length, 0)
console.log(`✓ ${countries.length} países, ${totalRegions} regiones`)
console.log('  → src/features/loader/data/geo-catalog.ts')
console.log('  → etl/data/countries.json')
