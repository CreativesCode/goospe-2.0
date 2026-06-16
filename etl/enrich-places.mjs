// Enriquecimiento IA de places (Fase 1). Idempotente: solo toca los que tienen ai_enriched_at = null.
// Persiste por lugar (re-runs no re-pagan). Registra costo en ai_usage.
//
// Uso:  node etl/enrich-places.mjs            (todos los pendientes)
//       node etl/enrich-places.mjs --limit 5  (solo 5, para validar antes de la corrida completa)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createAI, costUSD } from './lib/ai.mjs'

const CONCURRENCY = 5
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null

// ---- env ----
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2]])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ai = createAI(env)

const toVectorLiteral = (arr) => `[${arr.join(',')}]`
const dedupTags = (...lists) => [...new Set(lists.flat().filter(Boolean).map((t) => String(t).toLowerCase().trim()))].slice(0, 10)

async function processPlace(p) {
  const category = p.place_categories?.[0]?.categories?.name ?? 'Lugar'
  const city = p.address?.city ?? null
  const address = p.address?.formatted ?? null

  const enr = await ai.enrichText({ name: p.name, category, city, address, tags: p.tags })
  const tags = dedupTags(p.tags, enr.tags)
  const embedText = `${p.name}. ${category}. ${enr.vibe_line}. ${enr.description} Tags: ${tags.join(', ')}`
  const emb = await ai.embed(embedText)

  const { error: upErr } = await sb.from('places').update({
    description: enr.description,
    vibe_line: enr.vibe_line,
    tags,
    price_level: enr.price_level,
    embedding: toVectorLiteral(emb.vector),
    embedding_model: emb.model,
    ai_enriched_at: new Date().toISOString(),
  }).eq('id', p.id)
  if (upErr) throw upErr

  // telemetría de costo
  await sb.from('ai_usage').insert([
    { feature: 'enrich_text', model: enr.model, input_tokens: enr.usage.input, output_tokens: enr.usage.output,
      cost_usd: costUSD(enr.model, enr.usage.input, enr.usage.output) },
    { feature: 'enrich_embed', model: emb.model, input_tokens: emb.usage.tokens,
      cost_usd: costUSD(emb.model, emb.usage.tokens) },
  ])

  const cost = costUSD(enr.model, enr.usage.input, enr.usage.output) + costUSD(emb.model, emb.usage.tokens)
  return { name: p.name, vibe: enr.vibe_line, price: enr.price_level, cost }
}

async function pool(items, n, fn) {
  const results = []
  let i = 0
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++
      try { results[idx] = await fn(items[idx]) }
      catch (e) { results[idx] = { error: e.message, name: items[idx].name }; console.error(`  ✗ ${items[idx].name}: ${e.message}`) }
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  let q = sb.from('places')
    .select('id, name, address, tags, place_categories(categories(slug,name))')
    .is('ai_enriched_at', null)
    .order('name')
  if (LIMIT) q = q.limit(LIMIT)
  const { data: places, error } = await q
  if (error) throw error

  console.log(`> Pendientes de enriquecer: ${places.length}${LIMIT ? ` (limit ${LIMIT})` : ''}`)
  console.log(`> Texto: ${ai.textModel} · Embeddings: ${ai.embedModel}@${ai.embedDims}d · concurrencia ${CONCURRENCY}\n`)
  if (!places.length) { console.log('Nada que hacer.'); return }

  const t0 = Date.now()
  const res = await pool(places, CONCURRENCY, processPlace)
  const ok = res.filter((r) => r && !r.error)
  const failed = res.filter((r) => r && r.error)
  const totalCost = ok.reduce((s, r) => s + r.cost, 0)

  console.log('\n===== RESULTADO =====')
  console.log(`Enriquecidos OK: ${ok.length}   Fallidos: ${failed.length}   (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  console.log(`Costo total: $${totalCost.toFixed(4)} USD   (~$${(totalCost / Math.max(ok.length, 1)).toFixed(5)}/lugar)`)
  console.log('\nMuestra:')
  for (const r of ok.slice(0, 8)) console.log(`  · ${r.name} — "${r.vibe}" ${r.price ? '$'.repeat(r.price) : '(precio?)'}`)
  if (failed.length) console.log(`\n⚠ Fallidos (se reintentan en el próximo run): ${failed.map((f) => f.name).join(', ')}`)
}

main().catch((e) => { console.error('Enrich falló:', e.message); process.exit(1) })
