'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const placeId = formData.get('place_id') as string
  if (!placeId) redirect('/panel/claim?error=Falta+el+lugar')
  const user = await requireUser()
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
    contact_name: ((formData.get('contact_name') as string) ?? '').trim() || null,
    phone: ((formData.get('phone') as string) ?? '').trim() || null,
    email: user.email ?? null,
    message: ((formData.get('message') as string) ?? '').trim() || null,
  }

  await admin
    .from('claims')
    .insert({ place_id: placeId, user_id: user.id, method: 'manual', status: 'pending', evidence } as never)

  revalidatePath('/admin/claims')
  redirect('/panel/claim?sent=1')
}

const toArray = (s: string) =>
  s.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8)

// Edita la ficha del place. Sólo campos que el dueño debería controlar.
export async function updateListing(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const user = await requireUser()
  const admin = createAdminClient()

  const businessId = await assertMembership(admin, user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }

  const priceRaw = formData.get('price_level') as string
  const price = priceRaw ? Number(priceRaw) : null

  const patch = {
    description: (formData.get('description') as string)?.trim() || null,
    vibe_line: (formData.get('vibe_line') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    whatsapp: (formData.get('whatsapp') as string)?.trim() || null,
    website: (formData.get('website') as string)?.trim() || null,
    instagram: (formData.get('instagram') as string)?.trim() || null,
    price_level: price && price >= 1 && price <= 4 ? price : null,
    tags: toArray((formData.get('tags') as string) ?? ''),
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from('places').update(patch as never).eq('id', placeId)
  if (error) return { error: error.message }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/panel')
  return { success: true }
}
