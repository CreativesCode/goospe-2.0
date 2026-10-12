'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { notifyAdmins } from '@/lib/notify'
import { parseLatLng } from '@/lib/latlng'
import { isUuid } from '@/lib/validation'
import { firstIssue } from '@/features/business/listing-schema'
import { MAX_PENDING_PROPOSALS, placeProposalSchema } from '@/features/business/place-proposal-schema'

// "Proponer un lugar nuevo": cualquier usuario con sesión (dueño o no) cuyo lugar no está en
// Goospe. La tabla place_proposals no acepta escrituras del navegador: todo pasa por aquí con
// service role DESPUÉS de validar sesión, datos y frecuencia. Lo resuelve un admin.
const SEND_FAILED = 'No pudimos enviar la propuesta. Intenta de nuevo.'

async function sessionUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

export async function proposePlace(formData: FormData) {
  const user = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }

  const parsed = placeProposalSchema.safeParse({
    name: formData.get('name'),
    category_id: formData.get('category_id'),
    address: formData.get('address'),
    city_id: formData.get('city_id'),
    city_name: formData.get('city_name'),
    reference: formData.get('reference'),
    phone: formData.get('phone'),
    website: formData.get('website'),
    message: formData.get('message'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const input = parsed.data

  const admin = createAdminClient()
  const [{ data: category }, { data: city }, { count: pending }, { data: memberships }] = await Promise.all([
    admin.from('categories').select('id').eq('id', input.category_id).eq('enabled', true).maybeSingle(),
    input.city_id !== null
      ? admin.from('cities').select('id, name').eq('id', input.city_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('place_proposals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
    admin.from('business_members').select('business_id').eq('user_id', user.id).limit(1),
  ])
  if (!category) return { error: 'Elige una categoría de la lista' }
  const cityRow = city as { id: number; name: string } | null
  if (input.city_id !== null && !cityRow) return { error: 'Elige una ciudad de la lista' }
  if ((pending ?? 0) >= MAX_PENDING_PROPOSALS) {
    return { error: `Ya tienes ${MAX_PENDING_PROPOSALS} propuestas en revisión. Espera a que resolvamos alguna.` }
  }

  // Coordenadas si pegó un enlace de mapa o "lat, lng"; si no, queda la referencia escrita y
  // el admin ubica el pin al aprobar.
  const point = parseLatLng(input.reference)
  if (!point && /^\s*-?\d+(\.\d+)?\s*[,;]\s*-?\d+(\.\d+)?\s*$/.test(input.reference ?? '')) {
    return { error: 'Esas coordenadas no son válidas. Revisa la latitud y la longitud o pega el enlace del mapa.' }
  }
  // El límite se cuenta al final: los intentos que no pasan la validación no lo gastan.
  if (!(await rateLimit(`place-proposal:${user.id}`, 3600, 5))) {
    return { error: 'Enviaste muchas propuestas seguidas. Intenta de nuevo en un rato.' }
  }
  const { data: row, error } = await admin.from('place_proposals').insert({
    user_id: user.id,
    business_id: ((memberships ?? []) as { business_id: string }[])[0]?.business_id ?? null,
    name: input.name,
    category_id: input.category_id,
    address: input.address,
    city_id: cityRow?.id ?? null,
    city_name: cityRow?.name ?? input.city_name,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    location_ref: input.reference,
    phone: input.phone,
    website: input.website,
    message: input.message,
  }).select('id').single()
  if (error || !row) {
    if (error?.code === '23505') return { error: 'Ya tienes una propuesta en revisión con ese nombre' }
    console.error('[proposePlace]', error?.message)
    return { error: SEND_FAILED }
  }

  await notifyAdmins({
    kind: 'place_proposal_new',
    title: `Propuesta de lugar nuevo: ${input.name}`,
    body: [input.address, cityRow?.name ?? input.city_name].filter(Boolean).join(', '),
    link: '/admin/requests#propuestas',
  })
  await audit({
    userId: user.id, action: 'owner.place_proposal', objectType: 'place_proposal', objectId: row.id,
    payload: { name: input.name, category_id: input.category_id, city: cityRow?.name ?? input.city_name, lat: point?.lat ?? null, lng: point?.lng ?? null },
  })
  revalidatePath('/panel')
  revalidatePath('/admin/requests')
  return { success: true }
}

/** El solicitante retira una propuesta que sigue pendiente. */
export async function cancelPlaceProposal(formData: FormData) {
  const id = formData.get('proposal_id')
  if (!isUuid(id)) return { error: 'Solicitud inválida' }
  const user = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }

  const admin = createAdminClient()
  // Solo la propia y solo si sigue pendiente (el filtro va en el UPDATE: no hay carrera con el admin).
  const { data, error } = await admin.from('place_proposals')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id).eq('user_id', user.id).eq('status', 'pending').select('id')
  if (error) {
    console.error('[cancelPlaceProposal]', error.message)
    return { error: 'No pudimos cancelar la solicitud. Intenta de nuevo.' }
  }
  if (!data?.length) return { error: 'Esa solicitud ya fue resuelta' }
  await audit({ userId: user.id, action: 'owner.place_proposal_cancel', objectType: 'place_proposal', objectId: id })
  revalidatePath('/panel')
  revalidatePath('/admin/requests')
  return { success: true }
}
