import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type ResolvedBusiness = { businessId: string; created: boolean } | { error: string }

/**
 * Negocio al que se suma un lugar recién otorgado (reclamo aprobado o propuesta aprobada).
 * Un negocio puede tener varios lugares: si el usuario ya es owner de un negocio, el lugar
 * nuevo se suma a ese (el más antiguo). Solo se crea un negocio la primera vez.
 * SOLO llamar desde una acción de admin ya validada.
 */
export async function resolveBusiness(admin: AdminClient, userId: string, placeName: string): Promise<ResolvedBusiness> {
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
