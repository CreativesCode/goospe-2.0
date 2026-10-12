'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'
import { revalidatePlace } from '@/lib/revalidate-place'
import { zonedTimeToUtc } from '@/lib/tz'
import { isUuid, uuidSchema } from '@/lib/validation'

const IMG_MAX_BYTES = 5 * 1024 * 1024
const IMG_OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']
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

async function getUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

// El dueño crea un evento para su lugar. Escrituras a events son service_role → admin client
// con verificación de membresía. En el piloto se auto-aprueban (status='approved').
export async function createEvent(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = eventSchema.safeParse({
    place_id: formData.get('place_id'),
    name: formData.get('name'),
    description: formData.get('description'),
    starts_at: formData.get('starts_at') ?? '',
    ends_at: formData.get('ends_at'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del evento' }
  const { place_id: placeId, name, description } = parsed.data
  const image = formData.get('image') as File | null

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()

  // La hora que escribe el dueño es la hora LOCAL DEL LUGAR: se interpreta en la zona horaria
  // de su ciudad (cities.timezone). `new Date(valor)` la leería en la zona del servidor (UTC en
  // producción) y el evento saldría desplazado 3–4 h.
  const { data: placeRow } = await admin.from('places').select('slug, cities(timezone)').eq('id', placeId).maybeSingle()
  const place = placeRow as unknown as { slug: string; cities: { timezone: string } | null } | null
  if (!place) return { error: 'Lugar no encontrado' }
  const tz = place.cities?.timezone ?? null

  const startsDate = zonedTimeToUtc(parsed.data.starts_at, tz)
  if (!startsDate) return { error: 'Fecha de inicio inválida' }
  if (startsDate.getTime() < Date.now() - 60_000) return { error: 'La fecha de inicio no puede ser en el pasado' }
  const endsDate = parsed.data.ends_at ? zonedTimeToUtc(parsed.data.ends_at, tz) : null
  if (parsed.data.ends_at && !endsDate) return { error: 'Fecha de fin inválida' }
  if (endsDate && endsDate.getTime() < startsDate.getTime()) return { error: 'El fin no puede ser antes del inicio' }

  // Imagen opcional del evento → bucket `places` bajo events/{placeId}/…
  let imageUrl: string | null = null
  if (image && image.size > 0) {
    if (!IMG_OK_TYPES.includes(image.type)) return { error: 'Formato de imagen no soportado (JPG, PNG o WebP)' }
    if (image.size > IMG_MAX_BYTES) return { error: 'La imagen supera los 5 MB' }
    const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `events/${placeId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await image.arrayBuffer())
    const { error: upErr } = await admin.storage.from('places').upload(path, buffer, { contentType: image.type, upsert: false })
    if (upErr) {
      console.error('[createEvent] storage:', upErr.message)
      return { error: 'No pudimos subir la imagen. Intenta de nuevo.' }
    }
    imageUrl = admin.storage.from('places').getPublicUrl(path).data.publicUrl
  }

  const { error } = await admin.from('events').insert({
    place_id: placeId,
    business_id: businessId,
    name,
    description: description || null,
    image_url: imageUrl,
    starts_at: startsDate.toISOString(),
    ends_at: endsDate ? endsDate.toISOString() : null,
    status: 'approved',
  })
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[createEvent] insert:', error.message)
    return { error: error.code === '23505' ? 'Ya hay un evento en este lugar a esa hora' : SAVE_FAILED }
  }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/events')
  revalidatePath('/feed')
  await revalidatePlace(placeId, place.slug) // la ficha pública lista los próximos eventos
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
