'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/claims')
  if (!(await isAdmin(user.id))) redirect('/feed')
}

// Aprobar una solicitud de reclamo pendiente: recién aquí se otorga la propiedad.
// Crea el negocio, agrega al solicitante como owner, linkea el place y marca el claim
// como aprobado. Rechaza cualquier otra solicitud pendiente para el mismo lugar.
export async function approveClaim(formData: FormData) {
  await requireAdmin()
  const claimId = formData.get('claim_id') as string
  if (!claimId) return { error: 'Falta el reclamo' }
  const admin = createAdminClient()

  const { data: claimRow } = await admin.from('claims').select('id, place_id, user_id, status').eq('id', claimId).maybeSingle()
  const claim = claimRow as { id: string; place_id: string; user_id: string; status: string } | null
  if (!claim) return { error: 'Reclamo no encontrado' }

  const { data: placeRow } = await admin.from('places').select('id, name, claimed, business_id').eq('id', claim.place_id).maybeSingle()
  const place = placeRow as { id: string; name: string; claimed: boolean; business_id: string | null } | null
  if (!place) return { error: 'Lugar no encontrado' }
  if (place.claimed || place.business_id) {
    // Ya fue reclamado por otra vía → cierra este como rechazado para no dejarlo colgado.
    await admin.from('claims').update({ status: 'rejected' } as never).eq('id', claimId)
    return { error: 'Ese lugar ya fue reclamado' }
  }

  const { data: biz, error: bizErr } = await admin.from('businesses').insert({ name: place.name } as never).select('id').single()
  if (bizErr || !biz) return { error: 'No se pudo crear el negocio' }
  const businessId = (biz as { id: string }).id

  await admin.from('business_members').insert({ business_id: businessId, user_id: claim.user_id, role: 'owner' } as never)
  await admin.from('places').update({ business_id: businessId, claimed: true, source: 'owner', updated_at: new Date().toISOString() } as never).eq('id', claim.place_id)
  await admin.from('claims').update({ status: 'approved' } as never).eq('id', claimId)
  // Cierra las demás solicitudes pendientes del mismo lugar.
  await admin.from('claims').update({ status: 'rejected' } as never).eq('place_id', claim.place_id).eq('status', 'pending').neq('id', claimId)

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  return { success: true }
}

// Rechazar una solicitud de reclamo pendiente (no toca el lugar).
export async function rejectClaim(formData: FormData) {
  await requireAdmin()
  const claimId = formData.get('claim_id') as string
  if (!claimId) return { error: 'Falta el reclamo' }
  const admin = createAdminClient()
  const { error } = await admin.from('claims').update({ status: 'rejected' } as never).eq('id', claimId)
  if (error) return { error: error.message }
  revalidatePath('/admin/claims')
  return { success: true }
}

// Des-reclamar: rompe la relación lugar ↔ usuario/negocio sin borrar el lugar.
// Misma lógica que ejecutamos a mano: limpia claims/members, libera el place y
// borra el negocio si queda huérfano.
export async function unclaimPlace(formData: FormData) {
  await requireAdmin()
  const placeId = formData.get('place_id') as string
  if (!placeId) return { error: 'Falta el lugar' }
  const admin = createAdminClient()

  const { data: place } = await admin.from('places').select('business_id').eq('id', placeId).maybeSingle()
  const businessId = (place as { business_id: string | null } | null)?.business_id

  await admin.from('claims').delete().eq('place_id', placeId)
  await admin.from('places').update({ business_id: null, claimed: false, updated_at: new Date().toISOString() } as never).eq('id', placeId)

  if (businessId) {
    await admin.from('business_members').delete().eq('business_id', businessId)
    // borra el negocio sólo si ya no le queda ningún lugar
    const { count } = await admin.from('places').select('id', { count: 'exact', head: true }).eq('business_id', businessId)
    if (!count) await admin.from('businesses').delete().eq('id', businessId)
  }

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  return { success: true }
}
