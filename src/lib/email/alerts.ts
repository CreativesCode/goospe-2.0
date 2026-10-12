import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { absoluteUrl } from '@/lib/email/config'
import { sendEmail } from '@/lib/email/send'
import { recipientsOf } from '@/lib/email/recipients'
import { criticalReviewEmail } from '@/emails/alerts'

// Alerta por email de reseña crítica (1 o 2 estrellas) a los miembros del negocio.
//
// DÓNDE SE DETECTA: en un solo sitio, el trigger trg_notify_review (0037), que inserta la
// notificación `review_critical` por cada camino posible: reseña nueva por la server action,
// reseña que entra por la API y se aprueba después, o nota que se edita hacia abajo. Aquí NO
// se vuelve a decidir qué es "crítica": se drenan esas notificaciones y se manda un email por
// cada una que aún no lo tenga.
//
// POR QUÉ NO PUEDE ENVIAR DOS VECES: la clave del email es el id de la notificación
// (`review_critical:<id>`), única en email_log, y la notificación ya es única por reseña y
// miembro (notifications_dedupe_idx). Da igual quién llame (la acción justo después de
// guardar, la moderación al aprobar o el cron diario como red de seguridad) ni cuántas veces.

const WINDOW_HOURS = 72 // más viejo que esto ya no es una "alerta"
const MAX_PER_RUN = 200
const REVIEW_KEY = /^review:([0-9a-f-]{36}):c$/i

export const criticalReviewKey = (notificationId: string) => `review_critical:${notificationId}`

type NotificationRow = { id: string; user_id: string; place_id: string | null; dedupe_key: string | null }
type ReviewRow = { id: string; rating: number; body: string | null; status: string | null }
export type AlertCounts = { found: number; sent: number; skipped: number; failed: number }

export async function sendCriticalReviewAlerts(opts: { placeId?: string } = {}): Promise<AlertCounts> {
  const counts: AlertCounts = { found: 0, sent: 0, skipped: 0, failed: 0 }
  const admin = createAdminClient()
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString()

  let query = admin.from('notifications').select('id, user_id, place_id, dedupe_key')
    .eq('kind', 'review_critical').gte('created_at', since).order('created_at').limit(MAX_PER_RUN)
  if (opts.placeId) query = query.eq('place_id', opts.placeId)
  const { data, error } = await query
  if (error) throw new Error(`notificaciones: ${error.message}`)
  const pending = (data ?? []) as NotificationRow[]
  counts.found = pending.length
  if (!pending.length) return counts

  const reviewIdOf = (n: NotificationRow) => REVIEW_KEY.exec(n.dedupe_key ?? '')?.[1] ?? null
  const reviewIds = [...new Set(pending.map(reviewIdOf).filter((v): v is string => !!v))]
  const placeIds = [...new Set(pending.map((n) => n.place_id).filter((v): v is string => !!v))]
  const [{ data: reviewRows }, { data: placeRows }, recipients] = await Promise.all([
    admin.from('reviews').select('id, rating, body, status').in('id', reviewIds),
    admin.from('places').select('id, name').in('id', placeIds),
    recipientsOf(pending.map((n) => n.user_id), admin),
  ])
  const reviews = new Map(((reviewRows ?? []) as ReviewRow[]).map((r) => [r.id, r]))
  const places = new Map(((placeRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))
  const emails = new Map(recipients.map((r) => [r.userId, r.email]))

  for (const n of pending) {
    const review = reviews.get(reviewIdOf(n) ?? '')
    const placeName = n.place_id ? places.get(n.place_id) : undefined
    const to = emails.get(n.user_id)
    // La reseña pudo borrarse, bloquearse o corregirse hacia arriba desde que saltó el aviso.
    if (!review || review.status !== 'approved' || review.rating > 2 || !placeName || !n.place_id || !to) {
      counts.skipped++
      continue
    }
    const panelUrl = absoluteUrl(`/panel/${n.place_id}#resenas`)
    const res = await sendEmail({
      to, userId: n.user_id, template: 'review_critical', category: 'alerts',
      dedupeKey: criticalReviewKey(n.id),
      meta: { place_id: n.place_id, review_id: review.id },
      render: ({ unsubscribeUrl }) => criticalReviewEmail({ placeName, rating: review.rating, body: review.body, panelUrl, unsubscribeUrl }),
    })
    if (res.status === 'sent') counts.sent++
    else if (res.status === 'failed') counts.failed++
    else counts.skipped++
  }
  return counts
}
