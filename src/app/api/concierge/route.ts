import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedQuery, pickPlacesStream, type Candidate, type Usage } from '@/lib/ai/openai'
import { fireAndForget } from '@/lib/fire'
import { rateLimit, clientKey } from '@/lib/rate-limit'

const FALLBACK = { lat: -41.3195, lng: -72.9854 } // centro por defecto del piloto
const FREE_LIMIT = 20 // consultas/mes para usuarios autenticados en el piloto
const USER_PER_MINUTE = 5 // ráfaga por usuario (evita saltarse la cuota con peticiones en paralelo)
const ANON_DAILY = 15 // consultas/día por IP sin sesión (holgado: wifi compartida / CGNAT)
const ANON_GLOBAL_DAILY = 300 // cortafuegos: tope diario de TODAS las consultas anónimas
const GLOBAL_DAILY = 2000 // cortafuegos: tope diario de TODAS las consultas (con o sin sesión)
// El conserje gasta dinero: si el rate limit no responde, se rechaza (falla cerrado).
const STRICT = { failOpen: false }
const BUSY = 'El conserje está muy solicitado hoy. Intenta de nuevo más tarde.'
const DAY_S = 86400
const CANDIDATES = 12 // candidatos que ve el modelo para elegir 3
const MAX_EXCLUDE = 24

const bodySchema = z.object({
  query: z.string().trim().min(2).max(300),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  // Contexto opcional del formulario (chips "Con quién" y "Presupuesto").
  withWhom: z.enum(['solo', 'pareja', 'amigos', 'familia']).nullish(),
  budget: z.number().int().min(1).max(4).nullish(),
  // "Otras 3 opciones": lugares ya mostrados que no deben repetirse.
  exclude: z.array(z.string().uuid()).max(MAX_EXCLUDE).nullish(),
})

const WITH_WHOM: Record<string, string> = { solo: 'voy solo', pareja: 'voy en pareja', amigos: 'voy con amigos', familia: 'voy en familia' }

/** Pedido + contexto de los chips, en una sola frase para el embedding y para el modelo. */
function withContext(query: string, withWhom?: string | null, budget?: number | null): string {
  const extra = [
    withWhom ? WITH_WHOM[withWhom] : null,
    budget ? `presupuesto máximo ${'$'.repeat(budget)} (en una escala de $ a $$$$)` : null,
  ].filter(Boolean)
  return extra.length ? `${query} (${extra.join('; ')})` : query
}
// gpt-4o (aprox, USD por millón de tokens) + embeddings (despreciable, estimado).
const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10 + 0.00002

const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

// POST { query, lat?, lng?, withWhom?, budget?, exclude? } → stream SSE de picks [{...place, reason}]
export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const badQuery = parsed.error.issues.some((i) => i.path[0] === 'query')
    return NextResponse.json(
      { error: badQuery ? 'Escribe qué buscas (entre 2 y 300 caracteres)' : 'Ubicación inválida' },
      { status: 400 }
    )
  }
  const query = withContext(parsed.data.query, parsed.data.withWhom, parsed.data.budget)
  const exclude = new Set(parsed.data.exclude ?? [])
  const lat = parsed.data.lat ?? FALLBACK.lat
  const lng = parsed.data.lng ?? FALLBACK.lng

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
    if (!(await rateLimit(`concierge:user:${user.id}`, 60, USER_PER_MINUTE, STRICT))) {
      return NextResponse.json({ error: 'Vas muy rápido. Espera un momento y vuelve a preguntar.' }, { status: 429 })
    }
  } else {
    // Anónimos: límite diario por cliente + tope global (el gasto de OpenAI no puede quedar abierto).
    if (!(await rateLimit(`concierge:anon:${clientKey(req)}`, DAY_S, ANON_DAILY, STRICT))) {
      return NextResponse.json(
        { error: `Llegaste al límite de ${ANON_DAILY} consultas diarias sin cuenta. Crea tu cuenta gratis para seguir preguntando.` },
        { status: 429 }
      )
    }
    if (!(await rateLimit('concierge:anon:global', DAY_S, ANON_GLOBAL_DAILY, STRICT))) {
      return NextResponse.json(
        { error: 'El conserje está muy solicitado hoy. Crea tu cuenta gratis o inicia sesión para seguir preguntando.' },
        { status: 429 }
      )
    }
  }

  if (!(await rateLimit('concierge:global', DAY_S, GLOBAL_DAILY, STRICT))) {
    return NextResponse.json({ error: BUSY }, { status: 429 })
  }
  // La cuota se RESERVA antes de llamar a OpenAI (no al terminar el stream): así N peticiones
  // en paralelo no pasan todas con used=0.
  if (user) {
    const { error: quotaErr } = await admin.rpc('increment_concierge_quota', { p_user: user.id, p_month: month })
    if (quotaErr) {
      console.error('[concierge] cuota:', quotaErr.message)
      return NextResponse.json({ error: 'No pudimos buscar ahora. Intenta de nuevo.' }, { status: 500 })
    }
  }

  // 1) embedding → candidatos
  let cands: (Candidate & { slug: string; lat: number; lng: number; photo_url: string | null })[]
  try {
    const embedding = await embedQuery(query)
    const { data: candidates, error } = await admin.rpc('match_places', {
      p_embedding: JSON.stringify(embedding),
      // Se piden de más para que, tras quitar los ya mostrados, sigan quedando candidatos.
      p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: CANDIDATES + exclude.size,
    })
    if (error) throw new Error(error.message)
    cands = ((candidates ?? []) as typeof cands).filter((c) => !exclude.has(c.id)).slice(0, CANDIDATES)
  } catch (e) {
    // Nunca devolver el error crudo (Postgres / OpenAI) al cliente.
    console.error('[concierge] candidatos:', (e as Error).message)
    return NextResponse.json({ error: 'No pudimos buscar ahora. Intenta de nuevo.' }, { status: 500 })
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
        fireAndForget(admin.from('ai_usage').insert({
          feature: 'concierge', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
          input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
          cost_usd: COST(usage), user_id: user?.id ?? null,
        }), 'ai_usage:concierge')
        send({ type: 'done' })
      } catch (e) {
        console.error('[concierge] stream:', (e as Error).message)
        send({ type: 'error', error: 'No pudimos completar la respuesta. Intenta de nuevo.' })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  })
}
