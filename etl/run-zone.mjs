// CLI del cargador de zonas: corre el pipeline completo para un region_jobs existente.
// Lo invoca la ruta admin local (spawn) o el skill /load-zone, o se corre a mano.
//
// Uso:  node etl/run-zone.mjs --job <region_jobs.id>
import { runZoneLoad } from './lib/pipeline.mjs'

const i = process.argv.indexOf('--job')
const jobId = i !== -1 ? process.argv[i + 1] : null
if (!jobId) {
  console.error('Uso: node etl/run-zone.mjs --job <region_jobs.id>')
  process.exit(1)
}

runZoneLoad(jobId)
  .then((r) => {
    console.log('✓ Zona cargada:', JSON.stringify(r))
    process.exit(0)
  })
  .catch((e) => {
    console.error('✗ run-zone falló:', e.message)
    process.exit(1)
  })
