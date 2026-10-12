'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin-guard'
import { revalidatePlace } from '@/lib/revalidate-place'
import { audit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { slugify, uniqueSlug } from '@/lib/place-slug'
import { resolveBusiness } from '@/lib/resolve-business'
import { isUuid } from '@/lib/validation'
import type { Json } from '@/lib/database.types'
import { firstIssue } from '@/features/business/listing-schema'
import { rejectReasonSchema } from '@/features/business/owner-schemas'
import { approveProposalSchema } from '@/features/business/place-proposal-schema'
import { loadProposalDuplicates } from '@/features/admin/proposal-data'

// Bandeja de "lugares propuestos". Solo admin. Aprobar crea el lugar por el mismo camino que
// /admin/places (RPC admin_save_place, que asigna la ciudad) y lo vincula al negocio del
// solicitante igual que un reclamo aprobado.
type AdminClient = ReturnType<typeof createAdminClient>
type Proposal = {
  id: string; user_id: string; name: string; category_id: number | null; address: string | null
  city_id: number | null; phone: string | null; website: string | null
}
type Coords = { lat: number; lng: number; cityId: number | null }

const APPROVE_FAILED = 'No pudimos crear el lugar. La propuesta sigue pendiente; intenta de nuevo.'

async function adminId(): Promise<string | null> {
  const { user, admin } = await getAdminUser()
  return user && admin ? user.id : null
}

// Crea el lugar (sin publicar) y lo deja publicado y vinculado al negocio en un segundo paso.
// Si el segundo paso falla se borra el lugar recién creado: no debe quedar a medias.
async function createLinkedPlace(admin: AdminClient, p: Proposal, at: Coords, businessId: string) {
  const slug = await uniqueSlug(admin, slugify(p.name), null)
  const { data: newId, error: saveErr } = await admin.rpc('admin_save_place', {
    p_id: null, p_name: p.name, p_slug: slug, p_description: null, p_vibe_line: null,
    p_phone: p.phone, p_whatsapp: null, p_website: p.website, p_instagram: null, p_email: null,
    p_price_level: null, p_tags: [], p_lat: at.lat, p_lng: at.lng, p_is_published: false,
    p_category_ids: p.category_id !== null ? [p.category_id] : [],
    ...(at.cityId !== null ? { p_city_id: at.cityId } : {}), // vacío = la ciudad más cercana al pin
  } as never) // los parámetros de texto admiten null en la BD; los tipos generados no lo reflejan
  if (saveErr || typeof newId !== 'string') {
    return { error: saveErr?.code === 'P0001' ? saveErr.message : APPROVE_FAILED, detail: saveErr?.message }
  }
  const placeId: string = newId

  const { data: cityRow } = await admin.from('places').select('city_id, cities(name)').eq('id', placeId).maybeSingle()
  const city = cityRow as unknown as { city_id: number; cities: { name: string } | null } | null
  const address = { street: p.address, number: null, city: city?.cities?.name ?? null, formatted: p.address }
  const { error: linkErr } = await admin.from('places')
    .update({ business_id: businessId, claimed: true, source: 'owner', is_published: true, address: address as Json, updated_at: new Date().toISOString() })
    .eq('id', placeId)
  if (linkErr) {
    const { error: delErr } = await admin.from('places').delete().eq('id', placeId)
    if (delErr) console.error('[approvePlaceProposal] lugar huérfano sin publicar:', placeId, delErr.message)
    return { error: APPROVE_FAILED, detail: linkErr.message }
  }
  return { placeId, slug, cityId: city?.city_id ?? null }
}

export async function approvePlaceProposal(formData: FormData) {
  const actor = await adminId()
  if (!actor) return { error: 'No autorizado' }
  const id = formData.get('proposal_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const parsed = approveProposalSchema.safeParse({
    lat: formData.get('lat'), lng: formData.get('lng'),
    city_id: formData.get('city_id'), confirm_duplicate: formData.get('confirm_duplicate'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const at: Coords = { lat: parsed.data.lat, lng: parsed.data.lng, cityId: parsed.data.city_id }

  const admin = createAdminClient()
  const { data: found } = await admin.from('place_proposals')
    .select('id, user_id, name, category_id, address, city_id, phone, website').eq('id', id).eq('status', 'pending').maybeSingle()
  const proposal = found as Proposal | null
  if (!proposal) return { error: 'Esa propuesta ya fue resuelta' }

  // Duplicados con el pin DEFINITIVO (el que confirma el admin, no el que mandó el solicitante).
  const dups = await loadProposalDuplicates(admin, { name: proposal.name, lat: at.lat, lng: at.lng, cityId: at.cityId ?? proposal.city_id })
  const likely = dups.rows.filter((d) => d.level === 'high')
  if (!parsed.data.confirm_duplicate) {
    if (!dups.ok) return { error: 'No pudimos comprobar si el lugar ya existe. Revisa a mano y marca “No es un duplicado” para crearlo.' }
    if (likely.length) return { error: `Ya existe un lugar muy parecido: ${likely[0].name}. Si es otro, marca “No es un duplicado”.` }
  }

  // Toma la propuesta ANTES de crear nada (el filtro por estado va en el UPDATE): dos
  // aprobaciones a la vez no crean dos lugares.
  const now = new Date().toISOString()
  const { data: taken } = await admin.from('place_proposals')
    .update({ status: 'approved', resolved_at: now, resolved_by: actor })
    .eq('id', proposal.id).eq('status', 'pending').select('id')
  if (!taken?.length) return { error: 'Esa propuesta ya fue resuelta' }
  const release = () => admin.from('place_proposals')
    .update({ status: 'pending', resolved_at: null, resolved_by: null }).eq('id', proposal.id)

  const biz = await resolveBusiness(admin, proposal.user_id, proposal.name)
  if ('error' in biz) {
    console.error('[approvePlaceProposal] negocio:', biz.error)
    await release()
    return { error: 'No se pudo crear el negocio del solicitante' }
  }
  const created = await createLinkedPlace(admin, proposal, at, biz.businessId)
  if ('error' in created) {
    console.error('[approvePlaceProposal] lugar:', created.detail)
    if (biz.created) await admin.from('businesses').delete().eq('id', biz.businessId) // business_members cae por cascade
    await release()
    return { error: created.error }
  }
  const { placeId, slug } = created

  await admin.from('place_proposals').update({ place_id: placeId }).eq('id', proposal.id)
  // Reclamo ya aprobado: el lugar aparece en /admin/claims como cualquier otro con dueño y
  // des-reclamarlo restaura su origen ('admin': lo creó el equipo a partir de la propuesta).
  const { error: claimErr } = await admin.from('claims').insert({
    place_id: placeId, user_id: proposal.user_id, method: 'proposal', status: 'approved',
    evidence: { prev_source: 'admin', proposal_id: proposal.id }, resolved_at: now, resolved_by: actor,
  })
  if (claimErr) console.error('[approvePlaceProposal] reclamo:', claimErr.message)

  await notifyUser(proposal.user_id, {
    kind: 'place_proposal_resolved', title: `¡${proposal.name} ya está en Goospe!`,
    body: 'Aprobamos tu propuesta y ya administras el lugar. Completa su ficha, sube fotos y publica eventos.',
    link: `/panel/${placeId}`, placeId,
  })
  await audit({
    userId: actor, action: 'admin.place_proposal_approve', objectType: 'place_proposal', objectId: proposal.id,
    payload: {
      place_id: placeId, place: proposal.name, owner: proposal.user_id, business_id: biz.businessId, new_business: biz.created,
      lat: at.lat, lng: at.lng, city_id: created.cityId, duplicates_confirmed: likely.map((d) => d.id),
    },
  })

  revalidatePath('/admin/requests')
  revalidatePath('/admin/places')
  revalidatePath('/admin/claims')
  revalidatePath('/panel')
  revalidatePath('/feed')
  revalidatePath('/places')
  await revalidatePlace(placeId, slug)
  return { success: true }
}

export async function rejectPlaceProposal(formData: FormData) {
  const actor = await adminId()
  if (!actor) return { error: 'No autorizado' }
  const id = formData.get('proposal_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const parsed = rejectReasonSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const admin = createAdminClient()
  const { data, error } = await admin.from('place_proposals')
    .update({ status: 'rejected', reject_reason: parsed.data.reason, resolved_at: new Date().toISOString(), resolved_by: actor })
    .eq('id', id).eq('status', 'pending').select('id, user_id, name')
  if (error) {
    console.error('[rejectPlaceProposal]', error.message)
    return { error: 'No pudimos rechazar la propuesta. Intenta de nuevo.' }
  }
  const proposal = (data ?? [])[0] as { id: string; user_id: string; name: string } | undefined
  if (!proposal) return { error: 'Esa propuesta ya fue resuelta' }

  await notifyUser(proposal.user_id, {
    kind: 'place_proposal_resolved', title: `No aprobamos tu propuesta de ${proposal.name}`,
    body: `Motivo: ${parsed.data.reason}`, link: '/panel#solicitudes',
  })
  await audit({ userId: actor, action: 'admin.place_proposal_reject', objectType: 'place_proposal', objectId: proposal.id, payload: { place: proposal.name, requester: proposal.user_id, reason: parsed.data.reason } })
  revalidatePath('/admin/requests')
  revalidatePath('/panel')
  return { success: true }
}
