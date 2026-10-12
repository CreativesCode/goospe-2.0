'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin-guard'
import { revalidatePlace } from '@/lib/revalidate-place'
import { audit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { isUuid } from '@/lib/validation'
import { firstIssue } from '@/features/business/listing-schema'
import { rejectReasonSchema } from '@/features/business/owner-schemas'

// Bandeja de "solicitudes de cambio" del dueño (nombre / ubicación). Solo admin.
type RequestRow = {
  id: string; place_id: string; user_id: string; kind: 'name' | 'location'
  payload: { name?: string; lat?: number | null; lng?: number | null; reference?: string | null }
  status: string
}
type AdminClient = ReturnType<typeof createAdminClient>

const coordSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

async function adminId(): Promise<string | null> {
  const { user, admin } = await getAdminUser()
  return user && admin ? user.id : null
}

async function pendingRequest(admin: AdminClient, id: string): Promise<RequestRow | null> {
  const { data } = await admin.from('place_change_requests')
    .select('id, place_id, user_id, kind, payload, status').eq('id', id).eq('status', 'pending').maybeSingle()
  return data as unknown as RequestRow | null
}

// Aplica el cambio pedido sobre el lugar. Devuelve el resumen antes/después para la bitácora.
async function applyChange(admin: AdminClient, req: RequestRow, formData: FormData) {
  if (req.kind === 'name') {
    const name = req.payload.name?.trim()
    if (!name) return { error: 'La solicitud no trae un nombre' }
    const { data: prev } = await admin.from('places').select('name').eq('id', req.place_id).maybeSingle()
    // El slug NO cambia: los enlaces compartidos de la ficha siguen funcionando.
    const { error } = await admin.from('places').update({ name, updated_at: new Date().toISOString() }).eq('id', req.place_id)
    if (error) return { error: 'No pudimos cambiar el nombre', detail: error.message }
    return { before: { name: (prev as { name: string } | null)?.name ?? null }, after: { name } }
  }

  // Ubicación: las coordenadas que confirma el admin (precargadas con las del dueño si las dio).
  const coords = coordSchema.safeParse({ lat: formData.get('lat'), lng: formData.get('lng') })
  if (!coords.success) return { error: 'Indica latitud y longitud válidas para mover el pin' }
  const { data: prev } = await admin.rpc('places_lnglat', { ids: [req.place_id] })
  const { error } = await admin.rpc('admin_set_place_location', {
    p_place_id: req.place_id, p_lat: coords.data.lat, p_lng: coords.data.lng,
  })
  if (error) return { error: 'No pudimos mover el pin', detail: error.message }
  const old = (prev ?? [])[0] as { lat: number; lng: number } | undefined
  return { before: { lat: old?.lat ?? null, lng: old?.lng ?? null }, after: coords.data }
}

function refresh(placeId: string) {
  revalidatePath('/admin/requests')
  revalidatePath('/admin/places')
  revalidatePath('/panel')
  revalidatePath(`/panel/${placeId}`)
  return revalidatePlace(placeId)
}

export async function approveChangeRequest(formData: FormData) {
  const actor = await adminId()
  if (!actor) return { error: 'No autorizado' }
  const id = formData.get('request_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }

  const admin = createAdminClient()
  const req = await pendingRequest(admin, id)
  if (!req) return { error: 'Esa solicitud ya fue resuelta' }

  const applied = await applyChange(admin, req, formData)
  if ('error' in applied) {
    if (applied.detail) console.error('[approveChangeRequest]', applied.detail)
    return { error: applied.error }
  }

  await admin.from('place_change_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: actor })
    .eq('id', req.id).eq('status', 'pending')
  const what = req.kind === 'name' ? 'nombre' : 'ubicación'
  await notifyUser(req.user_id, {
    kind: 'change_request_resolved', title: `Aprobamos tu cambio de ${what}`,
    body: req.kind === 'name' ? `Tu lugar ahora se llama ${req.payload.name}` : 'Ya movimos el pin de tu lugar en el mapa.',
    link: `/panel/${req.place_id}`, placeId: req.place_id,
  })
  await audit({ userId: actor, action: 'admin.change_request_approve', objectType: 'change_request', objectId: req.id, payload: { place_id: req.place_id, kind: req.kind, before: applied.before, after: applied.after } })
  await refresh(req.place_id)
  return { success: true }
}

export async function rejectChangeRequest(formData: FormData) {
  const actor = await adminId()
  if (!actor) return { error: 'No autorizado' }
  const id = formData.get('request_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const parsed = rejectReasonSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const admin = createAdminClient()
  const { data, error } = await admin.from('place_change_requests')
    .update({ status: 'rejected', reject_reason: parsed.data.reason, resolved_at: new Date().toISOString(), resolved_by: actor })
    .eq('id', id).eq('status', 'pending').select('id, place_id, user_id, kind')
  if (error) {
    console.error('[rejectChangeRequest]', error.message)
    return { error: 'No pudimos rechazar la solicitud. Intenta de nuevo.' }
  }
  const req = (data ?? [])[0] as { id: string; place_id: string; user_id: string; kind: string } | undefined
  if (!req) return { error: 'Esa solicitud ya fue resuelta' }

  const what = req.kind === 'name' ? 'nombre' : 'ubicación'
  await notifyUser(req.user_id, {
    kind: 'change_request_resolved', title: `No aprobamos tu cambio de ${what}`,
    body: `Motivo: ${parsed.data.reason}`, link: '/panel#solicitudes', placeId: req.place_id,
  })
  await audit({ userId: actor, action: 'admin.change_request_reject', objectType: 'change_request', objectId: req.id, payload: { place_id: req.place_id, kind: req.kind, reason: parsed.data.reason } })
  await refresh(req.place_id)
  return { success: true }
}
