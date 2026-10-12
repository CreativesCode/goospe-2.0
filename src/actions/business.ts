'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { revalidatePlace } from '@/lib/revalidate-place'
import { claimSchema, listingSchema, firstIssue } from '@/features/business/listing-schema'

// Las escrituras a places/businesses sólo las permite service_role (ver 0004_rls).
// Por eso usamos el admin client, pero SIEMPRE validando en código la identidad y la
// membresía del usuario contra su sesión real.

async function requireUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel')
  return user
}

// Verifica que el usuario sea miembro del negocio dueño del place. Devuelve business_id.
async function assertMembership(admin: ReturnType<typeof createAdminClient>, userId: string, placeId: string) {
  const { data: place } = await admin.from('places').select('business_id').eq('id', placeId).single()
  const businessId = (place as { business_id: string | null } | null)?.business_id
  if (!businessId) return null
  const { data: member } = await admin
    .from('business_members')
    .select('user_id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  return member ? businessId : null
}

// Solicitud de reclamo (moderada): el usuario pide administrar un lugar y el reclamo queda
// PENDIENTE con sus datos de contacto en `evidence`. Un admin lo revisa personalmente en
// /admin/claims (aprobar/rechazar). NO se otorga la propiedad hasta la aprobación.
export async function claimPlace(formData: FormData) {
  const placeId = formData.get('place_id')
  if (!isUuid(placeId)) redirect('/panel/claim?error=Falta+el+lugar')
  const user = await requireUser()

  // Datos de contacto validados antes de tocar la base (el error vuelve por ?error= como el resto).
  const contact = claimSchema.safeParse({
    contact_name: formData.get('contact_name'),
    phone: formData.get('phone'),
    message: formData.get('message'),
  })
  if (!contact.success) redirect(`/panel/claim?error=${encodeURIComponent(firstIssue(contact.error))}`)

  const admin = createAdminClient()

  const { data: place } = await admin
    .from('places')
    .select('id, name, claimed, business_id')
    .eq('id', placeId)
    .single()
  const p = place as { id: string; name: string; claimed: boolean; business_id: string | null } | null
  if (!p) redirect('/panel/claim?error=Lugar+no+encontrado')
  if (p!.claimed || p!.business_id) redirect('/panel/claim?error=Este+lugar+ya+fue+reclamado')

  // Evita solicitudes duplicadas del mismo usuario para el mismo lugar.
  const { data: existing } = await admin
    .from('claims')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) redirect('/panel/claim?sent=1')

  // Datos de contacto para que el admin verifique de forma personal.
  const evidence = {
    contact_name: contact.data.contact_name,
    phone: contact.data.phone,
    email: user.email ?? null,
    message: contact.data.message,
  }

  await admin
    .from('claims')
    .insert({ place_id: placeId, user_id: user.id, method: 'manual', status: 'pending', evidence } as never)

  revalidatePath('/admin/claims')
  redirect('/panel/claim?sent=1')
}

// Edita la ficha del place. Sólo campos que el dueño debería controlar.
export async function updateListing(formData: FormData) {
  const placeId = formData.get('place_id')
  const user = await requireUser()
  if (!isUuid(placeId)) return { error: 'Lugar inválido' }
  const admin = createAdminClient()

  const businessId = await assertMembership(admin, user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const parsed = listingSchema.safeParse({
    description: formData.get('description'),
    vibe_line: formData.get('vibe_line'),
    phone: formData.get('phone'),
    whatsapp: formData.get('whatsapp'),
    website: formData.get('website'),
    instagram: formData.get('instagram'),
    price_level: formData.get('price_level'),
    tags: formData.get('tags'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const patch = { ...parsed.data, updated_at: new Date().toISOString() }

  const { error } = await admin.from('places').update(patch as never).eq('id', placeId)
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[updateListing]', error.message)
    return { error: 'No pudimos guardar. Intenta de nuevo.' }
  }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/panel')
  // La ficha pública es ISR de 1 h: sin esto el cambio del dueño tardaba hasta una hora en verse.
  await revalidatePlace(placeId)
  return { success: true }
}
