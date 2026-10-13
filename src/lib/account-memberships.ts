import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Membership } from '@/features/profile/account-deletion'

type AdminClient = ReturnType<typeof createAdminClient>
type MemberRow = { business_id: string; user_id: string; role: string | null }

/**
 * Negocios de un usuario con lo que hace falta para decidir si puede eliminar su cuenta:
 * lugares de cada negocio y otros miembros. Devuelve null si alguna lectura falla (quien
 * decide debe fallar cerrado). Quien llama ya validó la sesión: `userId` es el de esa sesión.
 */
export async function loadMemberships(admin: AdminClient, userId: string): Promise<Membership[] | null> {
  const { data: mine, error } = await admin.from('business_members').select('business_id, role').eq('user_id', userId)
  if (error) return null
  const own = (mine ?? []) as { business_id: string; role: string | null }[]
  if (!own.length) return []
  const ids = own.map((m) => m.business_id)
  const [biz, places, members] = await Promise.all([
    admin.from('businesses').select('id, name').in('id', ids),
    admin.from('places').select('name, business_id').in('business_id', ids),
    admin.from('business_members').select('business_id, user_id, role').in('business_id', ids),
  ])
  if (biz.error || places.error || members.error) return null
  const nameOf = new Map(((biz.data ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]))
  const placeRows = (places.data ?? []) as { name: string; business_id: string | null }[]
  const others = ((members.data ?? []) as MemberRow[]).filter((m) => m.user_id !== userId)
  return own.map((m) => ({
    businessId: m.business_id,
    businessName: nameOf.get(m.business_id) ?? 'tu negocio',
    role: m.role,
    placeNames: placeRows.filter((p) => p.business_id === m.business_id).map((p) => p.name),
    otherOwners: others.filter((o) => o.business_id === m.business_id && (o.role ?? 'owner') === 'owner').length,
    otherMembers: others.filter((o) => o.business_id === m.business_id).length,
  }))
}
