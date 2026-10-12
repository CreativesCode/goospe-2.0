import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Notificaciones in-app (tabla notifications). Las de "nueva reseña" y "alguien se apuntó" las
// generan triggers en la BD (0037); aquí van las que dependen de una acción con contexto.
export type NotificationKind =
  | 'event_reminder' | 'review_new' | 'review_critical' | 'event_rsvp'
  | 'claim_approved' | 'claim_rejected' | 'review_reply'
  | 'event_cancelled' | 'event_updated'
  | 'claim_new' | 'change_request_new' | 'change_request_resolved'

export type Notice = {
  kind: NotificationKind
  title: string
  body?: string | null
  /** Ruta interna de destino (empieza por "/"). */
  link?: string | null
  placeId?: string | null
  eventId?: string | null
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/** Inserta la misma notificación para varios usuarios. Nunca lanza: el aviso es secundario. */
export async function notifyUsers(userIds: string[], n: Notice): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('notifications').insert(
      ids.map((user_id) => ({
        user_id,
        kind: n.kind,
        title: clip(n.title, 140),
        body: n.body ? clip(n.body, 300) : null,
        link: n.link ?? null,
        place_id: n.placeId ?? null,
        event_id: n.eventId ?? null,
      }))
    )
    if (error) console.error(`[notify] ${n.kind}:`, error.message)
  } catch (e) {
    console.error(`[notify] ${n.kind}:`, (e as Error).message)
  }
}

export const notifyUser = (userId: string, n: Notice) => notifyUsers([userId], n)

/** Aviso al equipo: todos los perfiles con is_admin. */
export async function notifyAdmins(n: Notice): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('profiles').select('id').eq('is_admin', true)
    await notifyUsers(((data ?? []) as { id: string }[]).map((p) => p.id), n)
  } catch (e) {
    console.error('[notifyAdmins]', (e as Error).message)
  }
}

/** Aviso a los miembros de un negocio (opcionalmente sin quien hizo la acción). */
export async function notifyBusiness(businessId: string, n: Notice, exceptUserId?: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('business_members').select('user_id').eq('business_id', businessId)
    const ids = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== exceptUserId)
    await notifyUsers(ids, n)
  } catch (e) {
    console.error('[notifyBusiness]', (e as Error).message)
  }
}
