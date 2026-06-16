import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedQuery, pickPlaces, type Candidate } from '@/lib/ai/openai'

const FALLBACK = { lat: -41.3195, lng: -72.9854 } // Puerto Varas
const FREE_LIMIT = 20 // consultas/mes para usuarios autenticados en el piloto
// gpt-4o (aprox, USD por millón de tokens) + embeddings (despreciable, estimado).
const COST = (u: { input_tokens: number; output_tokens: number }) =>
  (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10 + 0.00002

const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

// POST { query, lat?, lng? } → { picks: [{...place, reason}] }
export async function POST(req: NextRequest) {
  let body: { query?: string; lat?: number; lng?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const query = (body.query ?? '').trim()
  if (query.length < 2) return NextResponse.json({ error: 'Escribe qué buscas' }, { status: 400 })
  const lat = body.lat ?? FALLBACK.lat
  const lng = body.lng ?? FALLBACK.lng

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  const admin = createAdminClient()

  // Cuota mensual sólo para usuarios autenticados (la tabla referencia auth.users).
  const month = firstOfMonth()
  if (user) {
    const { data: q } = await admin
      .from('concierge_quota').select('used').eq('user_id', user.id).eq('month', month).maybeSingle()
    const used = (q as { used: number } | null)?.used ?? 0
    if (used >= FREE_LIMIT) {
      return NextResponse.json(
        { error: `Llegaste a tu límite de ${FREE_LIMIT} consultas este mes. Pronto habrá un plan sin límites.` },
        { status: 429 }
      )
    }
  }

  try {
    // 1) embedding de la consulta → candidatos por similitud + cercanía
    const embedding = await embedQuery(query)
    const { data: candidates, error } = await admin.rpc('match_places', {
      p_embedding: JSON.stringify(embedding),
      p_lat: lat,
      p_lng: lng,
      p_radius_m: 25000,
      p_limit: 12,
    } as never)
    if (error) throw new Error(error.message)
    const cands = (candidates ?? []) as (Candidate & {
      slug: string; lat: number; lng: number; photo_url: string | null
    })[]
    if (!cands.length) return NextResponse.json({ picks: [] })

    // 2) el LLM elige 3 con su porqué
    const { picks, usage } = await pickPlaces(query, cands)
    const byId = new Map(cands.map((c) => [c.id, c]))
    const result = picks
      .map((p) => { const c = byId.get(p.id); return c ? { ...c, reason: p.reason } : null })
      .filter(Boolean)

    // 3) telemetría de coste + incremento atómico de cuota (no bloquea la respuesta)
    void admin.from('ai_usage').insert({
      feature: 'concierge', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
      cost_usd: COST(usage), user_id: user?.id ?? null,
    } as never)
    if (user) void admin.rpc('increment_concierge_quota', { p_user: user.id, p_month: month } as never)

    return NextResponse.json({ picks: result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
