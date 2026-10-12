'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { revalidatePlace } from '@/lib/revalidate-place'
import { isUuid } from '@/lib/validation'
import { audit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { firstIssue } from '@/features/business/listing-schema'
import { rejectReasonSchema } from '@/features/business/owner-schemas'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/claims')
  if (!(await isAdmin(user.id))) redirect('/feed')
  return user
}

type AdminClient = ReturnType<typeof createAdminClient>
type ClaimRow = { id: string; place_id: string; user_id: string; status: string; evidence: Record<string, unknown> | null }
type PlaceRow = { id: string; slug: string; name: string; claimed: boolean; business_id: string | null; source: string }

// Origen del lugar cuando no se sabe cuál tenía antes de reclamarse (todo el catálogo es OSM).
const DEFAULT_SOURCE = 'osm'
const OTHER_OWNER_REASON = 'Otra persona fue verificada como responsable de este lugar.'
const APPROVE_FAILED = 'No pudimos aprobar el reclamo. Intenta de nuevo.'

// Un negocio puede tener varios lugares: si el solicitante ya es owner de un negocio, el lugar
// nuevo se suma a ese (el más antiguo). Solo se crea un negocio la primera vez.
async function resolveBusiness(admin: AdminClient, userId: string, placeName: string) {
  const { data: rows } = await admin.from('business_members')
    .select('business_id, businesses(created_at)').eq('user_id', userId).eq('role', 'owner')
  const owned = ((rows ?? []) as unknown as { business_id: string; businesses: { created_at: string | null } | null }[])
    .sort((a, b) => (a.businesses?.created_at ?? '').localeCompare(b.businesses?.created_at ?? ''))
  if (owned.length) return { businessId: owned[0].business_id, created: false }

  const { data: biz, error: bizErr } = await admin.from('businesses').insert({ name: placeName }).select('id').single()
  if (bizErr || !biz) return { error: bizErr?.message ?? 'sin negocio' }
  const businessId = (biz as { id: string }).id
  const { error: memErr } = await admin.from('business_members').insert({ business_id: businessId, user_id: userId, role: 'owner' })
  if (memErr) {
    await admin.from('businesses').delete().eq('id', businessId)
    return { error: memErr.message }
  }
  return { businessId, created: true }
}

// Cierra las demás solicitudes pendientes del mismo lugar, con motivo y aviso a cada solicitante.
async function rejectCompetingClaims(admin: AdminClient, place: PlaceRow, approvedId: string, adminId: string) {
  const { data } = await admin.from('claims')
    .update({ status: 'rejected', reject_reason: OTHER_OWNER_REASON, resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq('place_id', place.id).eq('status', 'pending').neq('id', approvedId).select('user_id')
  for (const c of (data ?? []) as { user_id: string }[]) {
    await notifyUser(c.user_id, {
      kind: 'claim_rejected', title: `Tu reclamo de ${place.name} fue rechazado`,
      body: `Motivo: ${OTHER_OWNER_REASON}`, link: '/panel#solicitudes', placeId: place.id,
    })
  }
}

// Aprobar una solicitud de reclamo pendiente: recién aquí se otorga la propiedad.
// Linkea el place al negocio del solicitante (lo crea si no tiene), marca el claim como
// aprobado y rechaza cualquier otra solicitud pendiente del mismo lugar.
// La verificación del reclamo sigue siendo MANUAL (un admin pulsa este botón).
export async function approveClaim(formData: FormData) {
  const adminUser = await requireAdmin()
  const claimId = formData.get('claim_id')
  if (!isUuid(claimId)) return { error: 'Falta el reclamo' }
  const admin = createAdminClient()

  const { data: claimRow } = await admin.from('claims').select('id, place_id, user_id, status, evidence').eq('id', claimId).maybeSingle()
  const claim = claimRow as ClaimRow | null
  if (!claim) return { error: 'Reclamo no encontrado' }
  if (claim.status !== 'pending') return { error: 'Ese reclamo ya fue resuelto' }

  const { data: placeRow } = await admin.from('places').select('id, slug, name, claimed, business_id, source').eq('id', claim.place_id).maybeSingle()
  const place = placeRow as PlaceRow | null
  if (!place) return { error: 'Lugar no encontrado' }
  const now = new Date().toISOString()
  if (place.claimed || place.business_id) {
    // Ya fue reclamado por otra vía → cierra este como rechazado para no dejarlo colgado.
    await admin.from('claims').update({ status: 'rejected', reject_reason: OTHER_OWNER_REASON, resolved_at: now, resolved_by: adminUser.id }).eq('id', claimId)
    return { error: 'Ese lugar ya fue reclamado' }
  }

  const biz = await resolveBusiness(admin, claim.user_id, place.name)
  if ('error' in biz) {
    console.error('[approveClaim] negocio:', biz.error)
    return { error: 'No se pudo crear el negocio' }
  }
  const { businessId } = biz

  // Si algo falla a mitad, se deshace lo hecho: no debe quedar un negocio sin lugar ni dueño.
  // Un negocio que ya existía (varios lugares) NO se borra: solo se suelta el lugar.
  const fail = async (step: string, message: string) => {
    console.error(`[approveClaim] ${step}:`, message)
    await admin.from('places').update({ business_id: null, claimed: false, source: place.source }).eq('id', place.id).eq('business_id', businessId)
    if (biz.created) await admin.from('businesses').delete().eq('id', businessId) // business_members cae por cascade
    return { error: APPROVE_FAILED }
  }

  const { error: placeErr } = await admin.from('places')
    .update({ business_id: businessId, claimed: true, source: 'owner', updated_at: now })
    .eq('id', claim.place_id)
  if (placeErr) return fail('lugar', placeErr.message)

  // Se guarda el origen previo del lugar en la evidencia: des-reclamar lo restaura.
  const { error: claimErr } = await admin.from('claims')
    .update({ status: 'approved', resolved_at: now, resolved_by: adminUser.id, evidence: { ...(claim.evidence ?? {}), prev_source: place.source } })
    .eq('id', claimId)
  if (claimErr) return fail('reclamo', claimErr.message)

  await rejectCompetingClaims(admin, place, claim.id, adminUser.id)
  await notifyUser(claim.user_id, {
    kind: 'claim_approved', title: `¡Ya administras ${place.name}!`,
    body: 'Tu reclamo fue aprobado. Completa tu ficha, sube fotos y publica eventos.',
    link: `/panel/${place.id}`, placeId: place.id,
  })
  await audit({ userId: adminUser.id, action: 'admin.claim_approve', objectType: 'claim', objectId: claim.id, payload: { place_id: place.id, place: place.name, owner: claim.user_id, business_id: businessId, new_business: biz.created } })

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  await revalidatePlace(place.id, place.slug) // la ficha deja de ofrecer "¿Este es tu negocio?"
  return { success: true }
}

// Rechazar una solicitud de reclamo pendiente (no toca el lugar). El motivo es OBLIGATORIO:
// se guarda en el reclamo y se le muestra al solicitante en la campana y en "Mis solicitudes".
export async function rejectClaim(formData: FormData) {
  const adminUser = await requireAdmin()
  const claimId = formData.get('claim_id')
  if (!isUuid(claimId)) return { error: 'Falta el reclamo' }
  const parsed = rejectReasonSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const reason = parsed.data.reason

  const admin = createAdminClient()
  // Solo si sigue pendiente (el filtro va en el UPDATE).
  const { data, error } = await admin.from('claims')
    .update({ status: 'rejected', reject_reason: reason, resolved_at: new Date().toISOString(), resolved_by: adminUser.id })
    .eq('id', claimId).eq('status', 'pending').select('id, place_id, user_id')
  if (error) {
    console.error('[rejectClaim]', error.message)
    return { error: 'No pudimos rechazar el reclamo. Intenta de nuevo.' }
  }
  const claim = (data ?? [])[0] as { id: string; place_id: string; user_id: string } | undefined
  if (!claim) return { error: 'Ese reclamo ya fue resuelto' }

  const { data: placeRow } = await admin.from('places').select('name').eq('id', claim.place_id).maybeSingle()
  const placeName = (placeRow as { name: string } | null)?.name ?? 'tu lugar'
  await notifyUser(claim.user_id, {
    kind: 'claim_rejected', title: `Tu reclamo de ${placeName} fue rechazado`,
    body: `Motivo: ${reason}`, link: '/panel#solicitudes', placeId: claim.place_id,
  })
  await audit({ userId: adminUser.id, action: 'admin.claim_reject', objectType: 'claim', objectId: claim.id, payload: { place_id: claim.place_id, place: placeName, requester: claim.user_id, reason } })

  revalidatePath('/admin/claims')
  revalidatePath('/panel')
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
  const adminUser = await requireAdmin()
  const placeId = formData.get('place_id')
  if (!isUuid(placeId)) return { error: 'Falta el lugar' }
  const admin = createAdminClient()

  const stop = (step: string, message: string) => {
    console.error(`[unclaimPlace] ${step}:`, message)
    return { error: `No se pudo completar el des-reclamo (${step}). Revisa el lugar e intenta de nuevo.` }
  }

  const { data: placeRow, error: readErr } = await admin.from('places').select('slug, business_id, source, owner_paused_at').eq('id', placeId).maybeSingle()
  if (readErr) return stop('leer el lugar', readErr.message)
  const place = placeRow as { slug: string; business_id: string | null; source: string; owner_paused_at: string | null } | null
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

  // Las solicitudes de cambio del dueño saliente dejan de tener sentido.
  await admin.from('place_change_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolved_by: adminUser.id })
    .eq('place_id', placeId).eq('status', 'pending')

  const { error: claimErr } = await admin.from('claims').delete().eq('place_id', placeId)
  if (claimErr) return stop('borrar reclamos', claimErr.message)

  const { error: placeErr } = await admin.from('places')
    // Si el dueño saliente lo había pausado, vuelve a verse: la pausa era suya.
    .update({
      business_id: null, claimed: false, source: restoredSource, owner_paused_at: null,
      ...(place.owner_paused_at ? { is_published: true } : {}), updated_at: new Date().toISOString(),
    })
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

  await audit({ userId: adminUser.id, action: 'admin.place_unclaim', objectType: 'place', objectId: placeId, payload: { business_id: businessId, restored_source: restoredSource } })

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  revalidatePath('/events')
  revalidatePath('/feed')
  await revalidatePlace(placeId, place.slug)
  return { success: true }
}
