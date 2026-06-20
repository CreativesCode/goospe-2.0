// Re-enriquece los places con ai_enriched_at IS NULL de cada ciudad activa, usando el contexto
// correcto de ciudad/región/país. Pensado para corregir lugares REASIGNADOS de ciudad (su texto
// viejo mencionaba otra ciudad). Reusa enrichCity (mismo motor del pipeline). GASTA (OpenAI).
//
// Uso:  node etl/reenrich.mjs              (todas las ciudades activas)
//       node etl/reenrich.mjs --city 3     (solo una ciudad)
import { loadEnv, makeServiceClient } from './lib/env.mjs'
import { createAI } from './lib/ai.mjs'
import { enrichCity } from './lib/pipeline.mjs'

const arg = (flag, def = null) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : def
}

async function main() {
  const env = loadEnv()
  const sb = makeServiceClient(env)
  const ai = createAI(env)

  const onlyCity = arg('--city')
  let q = sb.from('cities').select('id, name, region, country').eq('is_active', true).order('id')
  if (onlyCity) q = q.eq('id', Number(onlyCity))
  const { data: cities, error } = await q
  if (error) throw error

  let totalCost = 0
  let totalEnriched = 0
  for (const c of cities ?? []) {
    const pendingRes = await sb
      .from('places').select('id', { count: 'exact', head: true })
      .eq('city_id', c.id).is('ai_enriched_at', null)
    const pending = pendingRes.count ?? 0
    if (!pending) { console.log(`· ${c.name}: 0 pendientes`); continue }
    console.log(`> ${c.name}: re-enriqueciendo ${pending}…`)
    const r = await enrichCity(sb, ai, {
      cityId: c.id,
      cityContext: { city: c.name, region: c.region, country: c.country },
      anchorLimit: 1000, // sin tope: queremos cubrir TODOS los reasignados
      onProgress: (p) => process.stdout.write(`\r  ${(p * 100).toFixed(0)}%   `),
    })
    process.stdout.write('\n')
    console.log(`  ✓ ${c.name}: ${r.enriched} enriquecidos ($${r.cost.toFixed(3)})`)
    totalCost += r.cost
    totalEnriched += r.enriched
  }
  console.log(`\n✓ Total: ${totalEnriched} lugares re-enriquecidos · $${totalCost.toFixed(3)}`)
}

main().catch((e) => { console.error('reenrich falló:', e.message); process.exit(1) })
