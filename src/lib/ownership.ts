import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Devuelve el business_id dueño de un place (o null si no está reclamado).
export async function getPlaceBusinessId(placeId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('places').select('business_id').eq('id', placeId).single()
  return (data as { business_id: string | null } | null)?.business_id ?? null
}

// Verifica que el usuario sea miembro del negocio dueño del place.
export async function assertPlaceMembership(userId: string, placeId: string): Promise<string | null> {
  const businessId = await getPlaceBusinessId(placeId)
  if (!businessId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('business_members')
    .select('user_id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  return data ? businessId : null
}

// True si el usuario es admin (profiles.is_admin).
export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  return !!(data as { is_admin: boolean | null } | null)?.is_admin
}
