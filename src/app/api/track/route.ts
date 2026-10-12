import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientKey } from '@/lib/rate-limit'
import { uuidSchema } from '@/lib/validation'

const KINDS = [
  'view_card', 'view_detail', 'save', 'unsave', 'dismiss',
  'directions', 'call', 'share', 'rsvp', 'concierge_pick',
] as const

const MAX_EVENTS = 50
const MAX_BODY_BYTES = 64 * 1024
const MAX_CONTEXT_CHARS = 2000 // `context` es un objeto pequeño (posición, origen…)
const MAX_REQUESTS_PER_HOUR = 600 // lotes por usuario o dispositivo (cada lote trae hasta MAX_EVENTS)
const MAX_REQUESTS_PER_HOUR_IP = 6000 // tope alto por IP: wifi compartida / CGNAT no deben perder métricas

// Mismo formato que envía src/lib/track.ts (los opcionales pueden venir como null).
const eventSchema = z.object({
  kind: z.enum(KINDS),
  place_id: uuidSchema.nullish(),
  event_id: uuidSchema.nullish(),
  context: z.record(z.string(), z.unknown()).nullish()
    .refine((c) => !c || JSON.stringify(c).length <= MAX_CONTEXT_CHARS),
  anon_id: z.string().max(64).nullish(),
})

const bad = (status = 400) => NextResponse.json({ ok: false }, { status })

// Registra interacciones (una o un lote). interactions sólo permite insert con user_id=auth.uid()
// por RLS, pero el feed es anónimo → usamos admin client fijando user_id de la sesión (si la hay)
// y guardando el id de dispositivo anónimo en `context`.
export async function POST(req: NextRequest) {
  // Tope de tamaño ANTES de parsear: se lee el texto y se mide (Content-Length puede faltar o mentir).
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return bad(413)
  let text: string
  try {
    text = await req.text()
  } catch {
    return bad()
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return bad(413)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return bad()
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad()

  // Acepta `{ events: [...] }` (lote nuevo) o un evento suelto (retrocompatibilidad).
  const batch = (body as { events?: unknown }).events
  const raw: unknown[] = Array.isArray(batch) ? batch : [body]
  // Los eventos inválidos se descartan uno a uno (no tumban el lote entero).
  const events = raw
    .slice(0, MAX_EVENTS)
    .map((e) => eventSchema.safeParse(e))
    .flatMap((r) => (r.success ? [r.data] : []))
  if (!events.length) return bad()

  // Solo resolvemos la sesión (round-trip de auth) si hay cookie de Supabase. El feed anónimo
  // (caso común) se identifica por anon_id y se ahorra el getUser() por completo.
  let userId: string | null = null
  const hasAuthCookie = req.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  if (hasAuthCookie) {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    userId = user?.id ?? null
  }

  // Límite por la identidad más fina disponible (usuario, o IP + dispositivo anónimo) y, como
  // el anon_id lo elige el cliente, un tope alto por IP que no se evita rotándolo.
  const ip = clientKey(req)
  const fineKey = userId ? `track:u:${userId}` : `track:a:${ip}:${events[0].anon_id ?? '-'}`
  const [fineOk, ipOk] = await Promise.all([
    rateLimit(fineKey, 3600, MAX_REQUESTS_PER_HOUR),
    rateLimit(`track:ip:${ip}`, 3600, MAX_REQUESTS_PER_HOUR_IP),
  ])
  if (!fineOk || !ipOk) return bad(429)

  const admin = createAdminClient()
  const rows = events.map((e) => ({
    user_id: userId,
    place_id: e.place_id ?? null,
    event_id: e.event_id ?? null,
    kind: e.kind,
    context: { ...(e.context ?? {}), anon_id: e.anon_id ?? null },
  }))
  const { error } = await admin.from('interactions').insert(rows as never)
  if (error) {
    console.error('[track] insert falló:', error.message)
    return bad(500)
  }

  return NextResponse.json({ ok: true })
}
