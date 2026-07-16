'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'

const IMG_MAX_BYTES = 5 * 1024 * 1024
const IMG_OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function getUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

// El dueño crea un evento para su lugar. Escrituras a events son service_role → admin client
// con verificación de membresía. En el piloto se auto-aprueban (status='approved').
export async function createEvent(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const name = ((formData.get('name') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim()
  const startsAt = formData.get('starts_at') as string
  const endsAt = (formData.get('ends_at') as string) || null
  const image = formData.get('image') as File | null

  const user = await getUser()
  if (!user) return { error: 'No autenticado' }
  if (!name) return { error: 'El evento necesita un nombre' }
  if (!startsAt) return { error: 'Indica fecha y hora de inicio' }

  const startsDate = new Date(startsAt)
  if (Number.isNaN(startsDate.getTime())) return { error: 'Fecha de inicio inválida' }
  if (startsDate.getTime() < Date.now() - 60_000) return { error: 'La fecha de inicio no puede ser en el pasado' }
  if (endsAt && new Date(endsAt).getTime() < startsDate.getTime()) return { error: 'El fin no puede ser antes del inicio' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()

  // Imagen opcional del evento → bucket `places` bajo events/{placeId}/…
  let imageUrl: string | null = null
  if (image && image.size > 0) {
    if (!IMG_OK_TYPES.includes(image.type)) return { error: 'Formato de imagen no soportado (JPG, PNG o WebP)' }
    if (image.size > IMG_MAX_BYTES) return { error: 'La imagen supera los 5 MB' }
    const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `events/${placeId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await image.arrayBuffer())
    const { error: upErr } = await admin.storage.from('places').upload(path, buffer, { contentType: image.type, upsert: false })
    if (upErr) return { error: upErr.message }
    imageUrl = admin.storage.from('places').getPublicUrl(path).data.publicUrl
  }

  const { error } = await admin.from('events').insert({
    place_id: placeId,
    business_id: businessId,
    name,
    description: description || null,
    image_url: imageUrl,
    starts_at: startsDate.toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    status: 'approved',
  } as never)
  if (error) return { error: error.message }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/events')
  return { success: true }
}

export async function deleteEvent(formData: FormData) {
  const eventId = formData.get('event_id') as string
  const placeId = formData.get('place_id') as string
  const user = await getUser()
  if (!user) return { error: 'No autenticado' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }

  const admin = createAdminClient()
  const { error } = await admin.from('events').delete().eq('id', eventId).eq('place_id', placeId)
  if (error) return { error: error.message }
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/events')
  return { success: true }
}

// RSVP del usuario (RLS "own rsvps" permite escribir con el user client). Toggle.
export async function toggleRsvp(formData: FormData) {
  const eventId = formData.get('event_id') as string
  const status = (formData.get('status') as string) || 'going'
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
    if (error) return { error: error.message }
    revalidatePath('/events')
    return { success: true, going: false }
  }

  const { error } = await sb
    .from('event_rsvps')
    .insert({ user_id: user.id, event_id: eventId, status } as never)
  if (error) return { error: error.message }
  revalidatePath('/events')
  return { success: true, going: true }
}
