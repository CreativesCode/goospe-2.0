import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const KINDS = new Set([
  'view_card', 'view_detail', 'save', 'unsave', 'dismiss',
  'directions', 'call', 'share', 'rsvp', 'concierge_pick',
])

// Registra una interacción. interactions sólo permite insert con user_id=auth.uid() por RLS,
// pero el feed es anónimo → usamos admin client fijando user_id de la sesión (si la hay) y
// guardando el id de dispositivo anónimo en `context`.
export async function POST(req: NextRequest) {
  let body: { kind?: string; place_id?: string | null; event_id?: string | null; context?: Record<string, unknown> | null; anon_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (!body.kind || !KINDS.has(body.kind)) return NextResponse.json({ ok: false }, { status: 400 })

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  const admin = createAdminClient()
  await admin.from('interactions').insert({
    user_id: user?.id ?? null,
    place_id: body.place_id ?? null,
    event_id: body.event_id ?? null,
    kind: body.kind,
    context: { anon_id: body.anon_id ?? null, ...(body.context ?? {}) },
  } as never)

  return NextResponse.json({ ok: true })
}
