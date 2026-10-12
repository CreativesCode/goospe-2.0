'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'
import { revalidatePlace } from '@/lib/revalidate-place'
import { fmtInZone, zonedTimeToUtc } from '@/lib/tz'
import { isUuid, uuidSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'
import { notifyUsers } from '@/lib/notify'
import { queueEventCancelledEmails, queueEventUpdatedEmails } from '@/lib/email/hooks'
import { rateLimit } from '@/lib/rate-limit'
import { BAD_IMAGE_FORMAT, IMAGE_MAX_BYTES, sniffImage } from '@/lib/image-sniff'
import { cancelEventSchema } from '@/features/business/owner-schemas'

const SAVE_FAILED = 'No pudimos guardar el evento. Intenta de nuevo.'

// Valor de <input type="datetime-local">: hora de pared SIN zona.
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const text = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(max, 'Texto demasiado largo'))

const eventSchema = z.object({
  place_id: uuidSchema,
  name: text(120).refine((v) => v.length > 0, 'El evento necesita un nombre'),
  description: text(2000),
  starts_at: z.string().regex(LOCAL_DT, 'Indica fecha y hora de inicio'),
  ends_at: z.preprocess((v) => (typeof v === 'string' && v ? v : null), z.string().regex(LOCAL_DT).nullable()),
})

type AdminClient = ReturnType<typeof createAdminClient>
type PlaceCtx = { slug: string; name: string; tz: string | null }

async function getUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

const readEventForm = (formData: FormData) => eventSchema.safeParse({
  place_id: formData.get('place_id'),
  name: formData.get('name'),
  description: formData.get('description'),
  starts_at: formData.get('starts_at') ?? '',
  ends_at: formData.get('ends_at'),
})

async function placeContext(admin: AdminClient, placeId: string): Promise<PlaceCtx | null> {
  const { data } = await admin.from('places').select('slug, name, cities(timezone)').eq('id', placeId).maybeSingle()
  const row = data as unknown as { slug: string; name: string; cities: { timezone: string } | null } | null
  return row ? { slug: row.slug, name: row.name, tz: row.cities?.timezone ?? null } : null
}

// La hora que escribe el dueño es la hora LOCAL DEL LUGAR: se interpreta en la zona horaria
// de su ciudad (cities.timezone). `new Date(valor)` la leería en la zona del servidor (UTC en
// producción) y el evento saldría desplazado 3–4 h.
function resolveTimes(startsLocal: string, endsLocal: string | null, tz: string | null, allowPast: boolean) {
  const starts = zonedTimeToUtc(startsLocal, tz)
  if (!starts) return { error: 'Fecha de inicio inválida' }
  if (!allowPast && starts.getTime() < Date.now() - 60_000) return { error: 'La fecha de inicio no puede ser en el pasado' }
  const ends = endsLocal ? zonedTimeToUtc(endsLocal, tz) : null
  if (endsLocal && !ends) return { error: 'Fecha de fin inválida' }
  if (ends && ends.getTime() < starts.getTime()) return { error: 'El fin no puede ser antes del inicio' }
  return { starts, ends }
}

// Imagen opcional del evento → bucket `places` bajo events/{placeId}/… El tipo sale de los
// magic bytes del archivo, no del mime que declara el navegador.
async function uploadEventImage(admin: AdminClient, entry: FormDataEntryValue | null, placeId: string) {
  const image = entry instanceof File ? entry : null
  if (!image || image.size === 0) return { url: null }
  if (image.size > IMAGE_MAX_BYTES) return { error: 'La imagen supera los 5 MB' }
  const buffer = Buffer.from(await image.arrayBuffer())
  const kind = sniffImage(buffer)
  if (!kind) return { error: BAD_IMAGE_FORMAT }
  const path = `events/${placeId}/${randomUUID()}.${kind.ext}`
  const { error } = await admin.storage.from('places').upload(path, buffer, { contentType: kind.mime, upsert: false })
  if (error) {
    console.error('[events] storage:', error.message)
    return { error: 'No pudimos subir la imagen. Intenta de nuevo.' }
  }
  return { url: admin.storage.from('places').getPublicUrl(path).data.publicUrl }
}

function refreshEventViews(placeId: string, slug?: string | null) {
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/events')
  revalidatePath('/feed')
  return revalidatePlace(placeId, slug) // la ficha pública lista los próximos eventos
}

// Usuarios inscritos a un evento (para avisarles de un cambio o de la cancelación).
async function attendeeIds(admin: AdminClient, eventId: string, exceptUserId: string): Promise<string[]> {
  const { data } = await admin.from('event_rsvps').select('user_id').eq('event_id', eventId)
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id).filter((id) => id !== exceptUserId)
}

const fmtWhen = (iso: string, tz: string | null) =>
  fmtInZone(iso, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// El dueño crea un evento para su lugar. Escrituras a events son service_role → admin client
// con verificación de membresía. En el piloto se auto-aprueban (status='approved').
export async function createEvent(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }
  const parsed = readEventForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del evento' }
  const { place_id: placeId, name, description } = parsed.data

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()
  const place = await placeContext(admin, placeId)
  if (!place) return { error: 'Lugar no encontrado' }
  const times = resolveTimes(parsed.data.starts_at, parsed.data.ends_at, place.tz, false)
  if ('error' in times) return { error: times.error }
  const image = await uploadEventImage(admin, formData.get('image'), placeId)
  if ('error' in image) return { error: image.error }

  const { error } = await admin.from('events').insert({
    place_id: placeId,
    business_id: businessId,
    name,
    description: description || null,
    image_url: image.url,
    starts_at: times.starts.toISOString(),
    ends_at: times.ends ? times.ends.toISOString() : null,
    status: 'approved',
  })
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[createEvent] insert:', error.message)
    return { error: error.code === '23505' ? 'Ya hay un evento en este lugar a esa hora' : SAVE_FAILED }
  }

  await refreshEventViews(placeId, place.slug)
  return { success: true }
}

type EventRow = { id: string; name: string; description: string | null; starts_at: string; ends_at: string | null; status: string | null }

// Lee el evento comprobando que sea de ESTE lugar.
async function findEvent(admin: AdminClient, eventId: string, placeId: string): Promise<EventRow | null> {
  const { data } = await admin.from('events').select('id, name, description, starts_at, ends_at, status')
    .eq('id', eventId).eq('place_id', placeId).maybeSingle()
  return data as EventRow | null
}

// Edita un evento existente. Si cambia la fecha/hora, avisa in-app a los inscritos.
export async function updateEvent(formData: FormData) {
  const eventId = formData.get('event_id')
  if (!isUuid(eventId)) return { error: 'Evento inválido' }
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }
  const parsed = readEventForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del evento' }
  const { place_id: placeId, name, description } = parsed.data
  if (!(await assertPlaceMembership(user.id, placeId))) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()
  const [ev, place] = await Promise.all([findEvent(admin, eventId, placeId), placeContext(admin, placeId)])
  if (!ev || !place) return { error: 'Evento no encontrado' }
  if (ev.status === 'cancelled') return { error: 'Ese evento está cancelado' }

  const times = resolveTimes(parsed.data.starts_at, parsed.data.ends_at, place.tz, true)
  if ('error' in times) return { error: times.error }
  const moved = times.starts.getTime() !== new Date(ev.starts_at).getTime()
  if (moved && times.starts.getTime() < Date.now() - 60_000) return { error: 'La fecha de inicio no puede ser en el pasado' }
  const image = await uploadEventImage(admin, formData.get('image'), placeId)
  if ('error' in image) return { error: image.error }

  const patch = {
    name,
    description: description || null,
    starts_at: times.starts.toISOString(),
    ends_at: times.ends ? times.ends.toISOString() : null,
    ...(image.url ? { image_url: image.url } : {}), // sin imagen nueva se conserva la actual
  }
  const { error } = await admin.from('events').update(patch).eq('id', ev.id).eq('place_id', placeId)
  if (error) {
    console.error('[updateEvent]', error.message)
    return { error: error.code === '23505' ? 'Ya hay un evento en este lugar a esa hora' : SAVE_FAILED }
  }

  if (moved) {
    const attendees = await attendeeIds(admin, ev.id, user.id)
    queueEventUpdatedEmails({
      eventId: ev.id, userIds: attendees, eventName: name, placeName: place.name, placeSlug: place.slug,
      when: fmtWhen(patch.starts_at, place.tz), startsAt: patch.starts_at,
    })
    await notifyUsers(attendees, {
      kind: 'event_updated',
      title: `Cambió la fecha: ${name}`,
      body: `Ahora es el ${fmtWhen(patch.starts_at, place.tz)} h en ${place.name}`,
      link: `/places/${place.slug}`,
      placeId,
      eventId: ev.id,
    })
  }
  const before = { name: ev.name, starts_at: ev.starts_at, ends_at: ev.ends_at }
  const after = { name, starts_at: patch.starts_at, ends_at: patch.ends_at }
  await audit({ userId: user.id, action: 'owner.event_update', objectType: 'event', objectId: ev.id, payload: { place_id: placeId, before, after } })
  await refreshEventViews(placeId, place.slug)
  return { success: true }
}

// Cancela un evento (queda en el historial del panel, deja de verse en la app) y avisa in-app
// a los inscritos. La notificación NO referencia event_id: si después se elimina el evento,
// el aviso de cancelación no debe desaparecer de la campana del usuario.
export async function cancelEvent(formData: FormData) {
  const eventId = formData.get('event_id')
  const placeId = formData.get('place_id')
  if (!isUuid(eventId) || !isUuid(placeId)) return { error: 'Evento inválido' }
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }
  if (!(await assertPlaceMembership(user.id, placeId))) return { error: 'Sin permiso' }
  const parsed = cancelEventSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Motivo inválido' }
  if (!(await rateLimit(`event-cancel:${user.id}`, 3600, 20))) return { error: 'Vas muy rápido. Intenta de nuevo en un rato.' }

  const admin = createAdminClient()
  const place = await placeContext(admin, placeId)
  if (!place) return { error: 'Lugar no encontrado' }
  // El filtro de estado va en el UPDATE: dos clics no avisan dos veces.
  const { data: rows, error } = await admin.from('events').update({ status: 'cancelled', is_boosted: false })
    .eq('id', eventId).eq('place_id', placeId).eq('status', 'approved').select('id, name, starts_at')
  if (error) {
    console.error('[cancelEvent]', error.message)
    return { error: 'No pudimos cancelar el evento. Intenta de nuevo.' }
  }
  const ev = (rows ?? [])[0] as { id: string; name: string; starts_at: string } | undefined
  if (!ev) return { error: 'Ese evento no está activo' }

  await admin.from('boosts').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('event_id', ev.id).eq('status', 'active')
  const reason = parsed.data.reason
  const attendees = await attendeeIds(admin, ev.id, user.id)
  queueEventCancelledEmails({
    eventId: ev.id, userIds: attendees, eventName: ev.name, placeName: place.name, placeSlug: place.slug,
    when: fmtWhen(ev.starts_at, place.tz), reason: reason || null,
  })
  await notifyUsers(attendees, {
    kind: 'event_cancelled',
    title: `Evento cancelado: ${ev.name}`,
    body: `${place.name} canceló el evento del ${fmtWhen(ev.starts_at, place.tz)} h.${reason ? ` Motivo: ${reason}` : ''}`,
    link: `/places/${place.slug}`,
    placeId,
  })
  await audit({ userId: user.id, action: 'owner.event_cancel', objectType: 'event', objectId: ev.id, payload: { place_id: placeId, name: ev.name, starts_at: ev.starts_at, reason } })
  await refreshEventViews(placeId, place.slug)
  return { success: true }
}

export async function deleteEvent(formData: FormData) {
  const eventId = formData.get('event_id')
  const placeId = formData.get('place_id')
  if (!isUuid(eventId) || !isUuid(placeId)) return { error: 'Evento inválido' }
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }

  const admin = createAdminClient()
  // El evento debe ser de ESTE lugar antes de tocar nada que cuelgue de él.
  const { data: ev } = await admin.from('events').select('id').eq('id', eventId).eq('place_id', placeId).maybeSingle()
  if (!ev) return { error: 'Evento no encontrado' }

  // Dependientes sin `on delete` en la BD original (un RSVP deja filas en interactions y el
  // boost en boosts): se sueltan aquí para que el borrado no falle con un error de clave
  // foránea. La migración 0035 hace lo mismo en la BD (set null / cascade); esto lo cubre
  // también antes de aplicarla. RSVPs y notificaciones ya caen por cascade.
  const { error: intErr } = await admin.from('interactions').update({ event_id: null }).eq('event_id', eventId)
  const { error: boostErr } = await admin.from('boosts').delete().eq('event_id', eventId)
  if (intErr || boostErr) console.error('[deleteEvent] dependientes:', intErr?.message ?? boostErr?.message)

  const { error } = await admin.from('events').delete().eq('id', eventId).eq('place_id', placeId)
  if (error) {
    console.error('[deleteEvent]', error.message)
    return {
      error: error.code === '23503'
        ? 'No pudimos eliminar el evento porque tiene actividad asociada. Escríbenos y lo resolvemos.'
        : 'No pudimos eliminar el evento. Intenta de nuevo.',
    }
  }
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/events')
  revalidatePath('/feed')
  await revalidatePlace(placeId)
  return { success: true }
}

// RSVP del usuario (RLS "own rsvps" permite escribir con el user client). Toggle.
export async function toggleRsvp(formData: FormData) {
  const eventId = formData.get('event_id')
  if (!isUuid(eventId)) return { error: 'Evento inválido' }
  const status = formData.get('status') === 'interested' ? 'interested' : 'going'
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para confirmar asistencia' }

  const { data: existing } = await sb
    .from('event_rsvps')
    .select('status')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing) {
    const { error } = await sb.from('event_rsvps').delete().eq('user_id', user.id).eq('event_id', eventId)
    if (error) {
      console.error('[toggleRsvp] delete:', error.message)
      return { error: 'No pudimos actualizar tu asistencia. Intenta de nuevo.' }
    }
    revalidatePath('/events')
    return { success: true, going: false }
  }

  const { error } = await sb
    .from('event_rsvps')
    .insert({ user_id: user.id, event_id: eventId, status } as never)
  if (error) {
    console.error('[toggleRsvp] insert:', error.message)
    return { error: error.code === '23503' ? 'Ese evento ya no existe' : 'No pudimos guardar tu asistencia. Intenta de nuevo.' }
  }
  revalidatePath('/events')
  return { success: true, going: true }
}
