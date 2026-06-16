'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'

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

  const user = await getUser()
  if (!user) return { error: 'No autenticado' }
  if (!name) return { error: 'El evento necesita un nombre' }
  if (!startsAt) return { error: 'Indica fecha y hora de inicio' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()
  const { error } = await admin.from('events').insert({
    place_id: placeId,
    business_id: businessId,
    name,
    description: description || null,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    status: 'approved',
  } as never)
  if (error) return { error: error.message }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/eventos')
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
  revalidatePath('/eventos')
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
    revalidatePath('/eventos')
    return { success: true, going: false }
  }

  const { error } = await sb
    .from('event_rsvps')
    .insert({ user_id: user.id, event_id: eventId, status } as never)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { success: true, going: true }
}
