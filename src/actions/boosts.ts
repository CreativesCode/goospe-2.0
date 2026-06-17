'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'

// Destaca un lugar en el feed por N días. En el piloto el boost es manual/gratuito
// (sin cobro todavía); cuando se integren pagos, este mismo registro se crea tras el pago.
export async function createBoost(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const days = Math.min(Math.max(Number(formData.get('days')) || 7, 1), 30)

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const admin = createAdminClient()
  const now = Date.now()
  const { error } = await admin.from('boosts').insert({
    business_id: businessId,
    place_id: placeId,
    starts_at: new Date(now).toISOString(),
    ends_at: new Date(now + days * 86400_000).toISOString(),
    amount_usd: 0,
    status: 'active',
  } as never)
  if (error) return { error: error.message }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/feed')
  return { success: true }
}

// Destaca un EVENTO en el feed por N días (boosts.event_id). Valida membresía vía el lugar del evento.
export async function boostEvent(formData: FormData) {
  const eventId = formData.get('event_id') as string
  const days = Math.min(Math.max(Number(formData.get('days')) || 7, 1), 30)

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = createAdminClient()
  const { data: ev } = await admin.from('events').select('place_id').eq('id', eventId).maybeSingle()
  const placeId = (ev as { place_id: string } | null)?.place_id
  if (!placeId) return { error: 'Evento no encontrado' }
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este evento' }

  const now = Date.now()
  const { error } = await admin.from('boosts').insert({
    business_id: businessId, place_id: placeId, event_id: eventId,
    starts_at: new Date(now).toISOString(),
    ends_at: new Date(now + days * 86400_000).toISOString(),
    amount_usd: 0, status: 'active',
  } as never)
  if (error) return { error: error.message }
  await admin.from('events').update({ is_boosted: true } as never).eq('id', eventId)

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/feed')
  return { success: true }
}

export async function endEventBoost(formData: FormData) {
  const eventId = formData.get('event_id') as string
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = createAdminClient()
  const { data: ev } = await admin.from('events').select('place_id').eq('id', eventId).maybeSingle()
  const placeId = (ev as { place_id: string } | null)?.place_id
  if (!placeId || !(await assertPlaceMembership(user.id, placeId))) return { error: 'Sin permiso' }

  await admin.from('boosts').update({ status: 'ended' } as never).eq('event_id', eventId).eq('status', 'active')
  await admin.from('events').update({ is_boosted: false } as never).eq('id', eventId)
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/feed')
  return { success: true }
}

export async function endBoost(formData: FormData) {
  const boostId = formData.get('boost_id') as string
  const placeId = formData.get('place_id') as string
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('boosts')
    .update({ status: 'ended' } as never)
    .eq('id', boostId)
    .eq('business_id', businessId)
  if (error) return { error: error.message }
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/feed')
  return { success: true }
}
