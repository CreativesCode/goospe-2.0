import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedQuery, pickPlacesStream, type Candidate, type Usage } from '@/lib/ai/openai'

const FALLBACK = { lat: -41.3195, lng: -72.9854 } // Puerto Varas
const FREE_LIMIT = 20 // consultas/mes para usuarios autenticados en el piloto
// gpt-4o (aprox, USD por millón de tokens) + embeddings (despreciable, estimado).
const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10 + 0.00002

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

  // 1) embedding → candidatos
  let cands: (Candidate & { slug: string; lat: number; lng: number; photo_url: string | null })[]
  try {
    const embedding = await embedQuery(query)
    const { data: candidates, error } = await admin.rpc('match_places', {
      p_embedding: JSON.stringify(embedding),
      p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: 12,
    } as never)
    if (error) throw new Error(error.message)
    cands = (candidates ?? []) as typeof cands
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // 2) stream SSE: primero los candidatos (para que el cliente arme las cards), luego cada pick
  const byId = new Map(cands.map((c) => [c.id, c]))
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        if (!cands.length) { send({ type: 'done' }); controller.close(); return }
        const usage = await pickPlacesStream(query, cands, (pick) => {
          const c = byId.get(pick.id)
          if (c) send({ type: 'pick', pick: { ...c, reason: pick.reason } })
        })
        void admin.from('ai_usage').insert({
          feature: 'concierge', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
          input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
          cost_usd: COST(usage), user_id: user?.id ?? null,
        } as never)
        if (user) void admin.rpc('increment_concierge_quota', { p_user: user.id, p_month: month } as never)
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', error: (e as Error).message })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  })
}
