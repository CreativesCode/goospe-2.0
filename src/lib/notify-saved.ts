import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUsers } from '@/lib/notify'
import { withoutMuted } from '@/lib/notification-prefs'
import { fmtInZone } from '@/lib/tz'
import { savedEventDedupeKey } from '@/features/notifications/kinds'
import { eventPath } from '@/features/places/seo-routes'

// "Un lugar que guardaste publicó un evento". Se llama desde createEvent, después de crear el
// evento. Reglas:
//   · solo a quien tiene el lugar en favoritos, sin contar a quien publicó;
//   · respeta la preferencia in-app "Lugares guardados" (notification_preferences.muted);
//   · tope de un aviso por lugar, por día y por persona: lo garantiza la clave de agrupación
//     con el índice único de notifications (sin carreras ni "ya avisé?" previo).
// Nunca lanza: el aviso es secundario y no debe hacer fallar la creación del evento.
const PAGE = 1000 // tope de filas por consulta de la API
const MAX_RECIPIENTS = 5000

export type SavedPlaceEvent = {
  placeId: string
  placeName: string
  placeSlug: string
  eventName: string
  /** Inicio del evento en ISO (UTC). */
  startsAt: string
  /** Zona horaria de la ciudad del lugar. */
  tz: string | null
  /** Quien publicó el evento (no se avisa a sí mismo). */
  exceptUserId?: string
}

export async function notifySavedPlaceEvent(ev: SavedPlaceEvent): Promise<void> {
  try {
    const admin = createAdminClient()
    const savers: string[] = []
    for (let from = 0; from < MAX_RECIPIENTS; from += PAGE) {
      const { data, error } = await admin.from('favorites')
        .select('user_id').eq('place_id', ev.placeId).order('user_id').range(from, from + PAGE - 1)
      if (error) {
        console.error('[notify-saved] favoritos:', error.message)
        return
      }
      const rows = (data ?? []) as { user_id: string }[]
      savers.push(...rows.map((r) => r.user_id))
      if (rows.length < PAGE) break
    }
    const targets = await withoutMuted(savers.filter((id) => id !== ev.exceptUserId), 'saved_places', admin)
    if (!targets.length) return

    // El id del evento se resuelve aquí (lugar + inicio es único) para enlazarlo en el aviso.
    const { data: row } = await admin.from('events')
      .select('id').eq('place_id', ev.placeId).eq('starts_at', ev.startsAt).maybeSingle()
    const eventId = (row as { id: string } | null)?.id ?? null
    const when = fmtInZone(ev.startsAt, ev.tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

    for (let i = 0; i < targets.length; i += 500) {
      await notifyUsers(targets.slice(i, i + 500), {
        kind: 'saved_place_event',
        title: `${ev.placeName} publicó un evento`,
        body: `${ev.eventName} · ${when} h`,
        // A la página del evento; si no se pudo resolver su id, a la ficha del lugar.
        link: eventId ? eventPath(eventId) : `/places/${ev.placeSlug}`,
        placeId: ev.placeId,
        eventId,
        dedupeKey: savedEventDedupeKey(ev.placeId),
      })
    }
  } catch (e) {
    console.error('[notify-saved]', (e as Error).message)
  }
}
