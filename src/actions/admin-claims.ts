'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { revalidatePlace } from '@/lib/revalidate-place'
import { isUuid } from '@/lib/validation'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/claims')
  if (!(await isAdmin(user.id))) redirect('/feed')
}

// Origen del lugar cuando no se sabe cuál tenía antes de reclamarse (todo el catálogo es OSM).
const DEFAULT_SOURCE = 'osm'

// Aprobar una solicitud de reclamo pendiente: recién aquí se otorga la propiedad.
// Crea el negocio, agrega al solicitante como owner, linkea el place y marca el claim
// como aprobado. Rechaza cualquier otra solicitud pendiente para el mismo lugar.
// La verificación del reclamo sigue siendo MANUAL (un admin pulsa este botón).
export async function approveClaim(formData: FormData) {
  await requireAdmin()
  const claimId = formData.get('claim_id')
  if (!isUuid(claimId)) return { error: 'Falta el reclamo' }
  const admin = createAdminClient()

  const { data: claimRow } = await admin.from('claims').select('id, place_id, user_id, status, evidence').eq('id', claimId).maybeSingle()
  const claim = claimRow as { id: string; place_id: string; user_id: string; status: string; evidence: Record<string, unknown> | null } | null
  if (!claim) return { error: 'Reclamo no encontrado' }
  if (claim.status !== 'pending') return { error: 'Ese reclamo ya fue resuelto' }

  const { data: placeRow } = await admin.from('places').select('id, slug, name, claimed, business_id, source').eq('id', claim.place_id).maybeSingle()
  const place = placeRow as { id: string; slug: string; name: string; claimed: boolean; business_id: string | null; source: string } | null
  if (!place) return { error: 'Lugar no encontrado' }
  if (place.claimed || place.business_id) {
    // Ya fue reclamado por otra vía → cierra este como rechazado para no dejarlo colgado.
    await admin.from('claims').update({ status: 'rejected' }).eq('id', claimId)
    return { error: 'Ese lugar ya fue reclamado' }
  }

  const { data: biz, error: bizErr } = await admin.from('businesses').insert({ name: place.name }).select('id').single()
  if (bizErr || !biz) return { error: 'No se pudo crear el negocio' }
  const businessId = (biz as { id: string }).id

  // Si algo falla a mitad, se deshace lo hecho: no debe quedar un negocio sin lugar ni dueño.
  const fail = async (step: string, message: string) => {
    console.error(`[approveClaim] ${step}:`, message)
    await admin.from('places').update({ business_id: null, claimed: false, source: place.source }).eq('id', place.id).eq('business_id', businessId)
    await admin.from('businesses').delete().eq('id', businessId) // business_members cae por cascade
    return { error: 'No pudimos aprobar el reclamo. Intenta de nuevo.' }
  }

  const { error: memErr } = await admin.from('business_members').insert({ business_id: businessId, user_id: claim.user_id, role: 'owner' })
  if (memErr) return fail('miembro', memErr.message)

  const { error: placeErr } = await admin.from('places')
    .update({ business_id: businessId, claimed: true, source: 'owner', updated_at: new Date().toISOString() })
    .eq('id', claim.place_id)
  if (placeErr) return fail('lugar', placeErr.message)

  // Se guarda el origen previo del lugar en la evidencia: des-reclamar lo restaura.
  const { error: claimErr } = await admin.from('claims')
    .update({ status: 'approved', evidence: { ...(claim.evidence ?? {}), prev_source: place.source } })
    .eq('id', claimId)
  if (claimErr) return fail('reclamo', claimErr.message)

  // Cierra las demás solicitudes pendientes del mismo lugar.
  await admin.from('claims').update({ status: 'rejected' }).eq('place_id', claim.place_id).eq('status', 'pending').neq('id', claimId)

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  await revalidatePlace(place.id, place.slug) // la ficha deja de ofrecer "¿Este es tu negocio?"
  return { success: true }
}

// Rechazar una solicitud de reclamo pendiente (no toca el lugar).
export async function rejectClaim(formData: FormData) {
  await requireAdmin()
  const claimId = formData.get('claim_id')
  if (!isUuid(claimId)) return { error: 'Falta el reclamo' }
  const admin = createAdminClient()
  const { error } = await admin.from('claims').update({ status: 'rejected' }).eq('id', claimId)
  if (error) {
    console.error('[rejectClaim]', error.message)
    return { error: 'No pudimos rechazar el reclamo. Intenta de nuevo.' }
  }
  revalidatePath('/admin/claims')
  return { success: true }
}

// Des-reclamar: rompe la relación lugar ↔ usuario/negocio sin borrar el lugar, y sin dejar
// residuos del dueño saliente:
//   · sus eventos de ESTE lugar se eliminan (antes los heredaba el siguiente dueño),
//   · se borran los boosts del lugar,
//   · places.source vuelve a su valor previo al reclamo,
//   · si el negocio se queda sin lugares se borran sus informes, boosts, miembros y el negocio.
// Cada paso comprueba su error y se detiene: mejor un des-reclamo a medias y avisado que uno
// "exitoso" con el negocio huérfano.
export async function unclaimPlace(formData: FormData) {
  await requireAdmin()
  const placeId = formData.get('place_id')
  if (!isUuid(placeId)) return { error: 'Falta el lugar' }
  const admin = createAdminClient()

  const stop = (step: string, message: string) => {
    console.error(`[unclaimPlace] ${step}:`, message)
    return { error: `No se pudo completar el des-reclamo (${step}). Revisa el lugar e intenta de nuevo.` }
  }

  const { data: placeRow, error: readErr } = await admin.from('places').select('slug, business_id, source').eq('id', placeId).maybeSingle()
  if (readErr) return stop('leer el lugar', readErr.message)
  const place = placeRow as { slug: string; business_id: string | null; source: string } | null
  if (!place) return { error: 'Lugar no encontrado' }
  const businessId = place.business_id

  // Origen previo: lo guardó approveClaim en la evidencia del reclamo aprobado.
  const { data: claimRows } = await admin.from('claims').select('evidence').eq('place_id', placeId).eq('status', 'approved').limit(1)
  const prev = ((claimRows ?? []) as { evidence: { prev_source?: unknown } | null }[])[0]?.evidence?.prev_source
  const restoredSource =
    place.source !== 'owner' ? place.source : typeof prev === 'string' && prev && prev !== 'owner' ? prev : DEFAULT_SOURCE

  if (businessId) {
    // Eventos del dueño saliente en este lugar (y lo que cuelga de ellos).
    const { data: evRows, error: evReadErr } = await admin.from('events').select('id').eq('place_id', placeId).eq('business_id', businessId)
    if (evReadErr) return stop('leer eventos', evReadErr.message)
    const eventIds = ((evRows ?? []) as { id: string }[]).map((e) => e.id)
    if (eventIds.length) {
      const { error: e1 } = await admin.from('interactions').update({ event_id: null }).in('event_id', eventIds)
      if (e1) return stop('soltar interacciones', e1.message)
      const { error: e2 } = await admin.from('boosts').delete().in('event_id', eventIds)
      if (e2) return stop('borrar boosts de eventos', e2.message)
      const { error: e3 } = await admin.from('events').delete().in('id', eventIds)
      if (e3) return stop('borrar eventos', e3.message)
    }
    const { error: bErr } = await admin.from('boosts').delete().eq('place_id', placeId)
    if (bErr) return stop('borrar boosts', bErr.message)
  }

  const { error: claimErr } = await admin.from('claims').delete().eq('place_id', placeId)
  if (claimErr) return stop('borrar reclamos', claimErr.message)

  const { error: placeErr } = await admin.from('places')
    .update({ business_id: null, claimed: false, source: restoredSource, updated_at: new Date().toISOString() })
    .eq('id', placeId)
  if (placeErr) return stop('liberar el lugar', placeErr.message)

  if (businessId) {
    // El negocio solo se elimina si ya no le queda ningún lugar.
    const { count, error: countErr } = await admin.from('places').select('id', { count: 'exact', head: true }).eq('business_id', businessId)
    if (countErr) return stop('contar lugares del negocio', countErr.message)
    if (!count) {
      const { error: r1 } = await admin.from('business_reports').delete().eq('business_id', businessId)
      if (r1) return stop('borrar informes', r1.message)
      const { error: r2 } = await admin.from('boosts').delete().eq('business_id', businessId)
      if (r2) return stop('borrar boosts del negocio', r2.message)
      const { error: r3 } = await admin.from('events').update({ business_id: null }).eq('business_id', businessId)
      if (r3) return stop('soltar eventos del negocio', r3.message)
      const { error: r4 } = await admin.from('business_members').delete().eq('business_id', businessId)
      if (r4) return stop('borrar miembros', r4.message)
      const { error: r5 } = await admin.from('businesses').delete().eq('id', businessId)
      if (r5) return stop('borrar el negocio', r5.message)
    }
  }

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  revalidatePath('/events')
  revalidatePath('/feed')
  await revalidatePlace(placeId, place.slug)
  return { success: true }
}
