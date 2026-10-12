'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/owner-guard'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePlace } from '@/lib/revalidate-place'
import { audit } from '@/lib/audit'
import { notifyAdmins } from '@/lib/notify'
import { parseLatLng } from '@/lib/latlng'
import { isUuid } from '@/lib/validation'
import type { Json } from '@/lib/database.types'
import { firstIssue } from '@/features/business/listing-schema'
import { brandVoiceSchema, changeRequestSchema } from '@/features/business/owner-schemas'

// Lo que el dueño NO cambia por sí mismo (nombre, pin del mapa) y el ciclo de sus solicitudes;
// además, pausar el lugar y el tono de marca del negocio.
const SAVE_FAILED = 'No pudimos guardar. Intenta de nuevo.'

async function sessionUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

/** "Pedir cambio a Goospe": nombre o ubicación en el mapa. Lo resuelve un admin. */
export async function requestPlaceChange(formData: FormData) {
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const parsed = changeRequestSchema.safeParse({
    kind: formData.get('kind'),
    name: formData.get('name'),
    reference: formData.get('reference'),
    message: formData.get('message'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!(await rateLimit(`change-request:${ctx.user.id}`, 3600, 10))) {
    return { error: 'Enviaste muchas solicitudes seguidas. Intenta de nuevo en un rato.' }
  }

  const admin = createAdminClient()
  const [{ data: placeRow }, { data: coords }] = await Promise.all([
    admin.from('places').select('name, address').eq('id', ctx.placeId).maybeSingle(),
    admin.rpc('places_lnglat', { ids: [ctx.placeId] }),
  ])
  const place = placeRow as { name: string; address: Json | null } | null
  if (!place) return { error: 'Lugar no encontrado' }

  const req = parsed.data
  if (req.kind === 'name' && req.name === place.name) return { error: 'Ese ya es el nombre del lugar' }
  // Coordenadas si el dueño pegó un enlace de mapa o "lat, lng"; si no, queda la referencia escrita.
  const point = req.kind === 'location' ? parseLatLng(req.reference) : null
  const payload = req.kind === 'name'
    ? { name: req.name }
    : { lat: point?.lat ?? null, lng: point?.lng ?? null, reference: req.reference }
  const ll = (coords ?? [])[0] as { lat: number; lng: number } | undefined
  const current = req.kind === 'name' ? { name: place.name } : { lat: ll?.lat ?? null, lng: ll?.lng ?? null, address: place.address }

  const { data: row, error } = await admin.from('place_change_requests').insert({
    place_id: ctx.placeId, business_id: ctx.businessId, user_id: ctx.user.id, kind: req.kind,
    payload: payload as Json, current_value: current as Json, message: req.message,
  }).select('id').single()
  if (error || !row) {
    if (error?.code === '23505') return { error: 'Ya tienes una solicitud de este tipo en revisión' }
    console.error('[requestPlaceChange]', error?.message)
    return { error: 'No pudimos enviar la solicitud. Intenta de nuevo.' }
  }

  await notifyAdmins({
    kind: 'change_request_new',
    title: `Solicitud de cambio de ${req.kind === 'name' ? 'nombre' : 'ubicación'}: ${place.name}`,
    body: req.kind === 'name' ? `Nuevo nombre: ${req.name}` : req.reference,
    link: '/admin/requests',
    placeId: ctx.placeId,
  })
  await audit({ userId: ctx.user.id, action: 'owner.change_request', objectType: 'change_request', objectId: row.id, payload: { place_id: ctx.placeId, kind: req.kind, before: current, after: payload } })
  revalidatePath(`/panel/${ctx.placeId}`)
  revalidatePath('/panel')
  revalidatePath('/admin/requests')
  return { success: true }
}

/** El solicitante retira una solicitud de cambio que sigue pendiente. */
export async function cancelChangeRequest(formData: FormData) {
  const id = formData.get('request_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const user = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }

  const admin = createAdminClient()
  // Solo la propia y solo si sigue pendiente (el filtro va en el UPDATE: no hay carrera con el admin).
  const { data, error } = await admin.from('place_change_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id).eq('user_id', user.id).eq('status', 'pending').select('id, place_id')
  if (error) {
    console.error('[cancelChangeRequest]', error.message)
    return { error: 'No pudimos cancelar la solicitud. Intenta de nuevo.' }
  }
  if (!data?.length) return { error: 'Esa solicitud ya fue resuelta' }
  revalidatePath('/panel')
  revalidatePath(`/panel/${data[0].place_id}`)
  revalidatePath('/admin/requests')
  return { success: true }
}

/** El solicitante cancela un reclamo que sigue pendiente. */
export async function cancelClaim(formData: FormData) {
  const id = formData.get('claim_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const user = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }

  const admin = createAdminClient()
  const { data, error } = await admin.from('claims')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id).eq('user_id', user.id).eq('status', 'pending').select('id')
  if (error) {
    console.error('[cancelClaim]', error.message)
    return { error: 'No pudimos cancelar la solicitud. Intenta de nuevo.' }
  }
  if (!data?.length) return { error: 'Esa solicitud ya fue resuelta' }
  await audit({ userId: user.id, action: 'owner.claim_cancel', objectType: 'claim', objectId: id })
  revalidatePath('/panel')
  revalidatePath('/admin/claims')
  return { success: true }
}

/**
 * "Cerrado temporalmente": el dueño oculta su lugar del feed y lo reactiva cuando quiera.
 * Solo puede reactivar lo que ÉL pausó (owner_paused_at): un lugar ocultado por un admin
 * no se publica desde aquí.
 */
export async function setPlacePaused(formData: FormData) {
  const paused = formData.get('paused') === '1'
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const admin = createAdminClient()
  const { data: row } = await admin.from('places').select('slug, is_published, owner_paused_at').eq('id', ctx.placeId).maybeSingle()
  const place = row as { slug: string; is_published: boolean | null; owner_paused_at: string | null } | null
  if (!place) return { error: 'Lugar no encontrado' }

  if (paused) {
    if (!place.is_published) return { error: place.owner_paused_at ? 'El lugar ya está pausado' : 'El lugar está oculto por Goospe' }
  } else if (!place.owner_paused_at) {
    return { error: place.is_published ? 'El lugar ya está visible' : 'Este lugar lo ocultó Goospe. Escríbenos para reactivarlo.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('places')
    .update({ is_published: !paused, owner_paused_at: paused ? now : null, updated_at: now })
    .eq('id', ctx.placeId)
  if (error) {
    console.error('[setPlacePaused]', error.message)
    return { error: SAVE_FAILED }
  }

  await audit({ userId: ctx.user.id, action: paused ? 'owner.place_pause' : 'owner.place_resume', objectType: 'place', objectId: ctx.placeId, payload: { before: { is_published: place.is_published }, after: { is_published: !paused } } })
  revalidatePath(`/panel/${ctx.placeId}`)
  revalidatePath('/panel')
  revalidatePath('/feed')
  revalidatePath('/places')
  await revalidatePlace(ctx.placeId, place.slug)
  return { success: true, paused }
}

/** Tono de marca del negocio (lo lee la IA al redactar promos y respuestas). Solo el owner. */
export async function updateBrandVoice(formData: FormData) {
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }
  const parsed = brandVoiceSchema.safeParse({ brand_voice: formData.get('brand_voice') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const admin = createAdminClient()
  const { data: member } = await admin.from('business_members').select('role')
    .eq('business_id', ctx.businessId).eq('user_id', ctx.user.id).maybeSingle()
  if ((member as { role: string | null } | null)?.role !== 'owner') return { error: 'Solo el dueño del negocio puede cambiar el tono de marca' }

  const { data: biz } = await admin.from('businesses').select('brand_voice').eq('id', ctx.businessId).maybeSingle()
  const before = (biz as { brand_voice: string | null } | null)?.brand_voice ?? null
  const { error } = await admin.from('businesses').update({ brand_voice: parsed.data.brand_voice }).eq('id', ctx.businessId)
  if (error) {
    console.error('[updateBrandVoice]', error.message)
    return { error: SAVE_FAILED }
  }

  await audit({ userId: ctx.user.id, action: 'owner.brand_voice_update', objectType: 'business', objectId: ctx.businessId, payload: { before, after: parsed.data.brand_voice } })
  revalidatePath(`/panel/${ctx.placeId}`)
  return { success: true }
}
