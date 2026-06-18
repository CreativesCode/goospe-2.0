import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const KINDS = new Set([
  'view_card', 'view_detail', 'save', 'unsave', 'dismiss',
  'directions', 'call', 'share', 'rsvp', 'concierge_pick',
])

type RawEvent = { kind?: string; place_id?: string | null; event_id?: string | null; context?: Record<string, unknown> | null; anon_id?: string | null }

const MAX_EVENTS = 50

// Registra interacciones (una o un lote). interactions sólo permite insert con user_id=auth.uid()
// por RLS, pero el feed es anónimo → usamos admin client fijando user_id de la sesión (si la hay)
// y guardando el id de dispositivo anónimo en `context`.
export async function POST(req: NextRequest) {
  let body: { events?: RawEvent[] } | RawEvent
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Acepta `{ events: [...] }` (lote nuevo) o un evento suelto (retrocompatibilidad).
  const raw: RawEvent[] = Array.isArray((body as { events?: RawEvent[] }).events)
    ? (body as { events: RawEvent[] }).events
    : [body as RawEvent]
  const events = raw.filter((e) => e && typeof e.kind === 'string' && KINDS.has(e.kind)).slice(0, MAX_EVENTS)
  if (!events.length) return NextResponse.json({ ok: false }, { status: 400 })

  // Solo resolvemos la sesión (round-trip de auth) si hay cookie de Supabase. El feed anónimo
  // (caso común) se identifica por anon_id y se ahorra el getUser() por completo.
  let userId: string | null = null
  const hasAuthCookie = req.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  if (hasAuthCookie) {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    userId = user?.id ?? null
  }

  const admin = createAdminClient()
  const rows = events.map((e) => ({
    user_id: userId,
    place_id: e.place_id ?? null,
    event_id: e.event_id ?? null,
    kind: e.kind,
    context: { anon_id: e.anon_id ?? null, ...(e.context ?? {}) },
  }))
  await admin.from('interactions').insert(rows as never)

  return NextResponse.json({ ok: true })
}
