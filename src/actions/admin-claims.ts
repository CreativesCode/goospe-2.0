'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/claims')
  if (!(await isAdmin(user.id))) redirect('/feed')
}

// Des-reclamar: rompe la relación lugar ↔ usuario/negocio sin borrar el lugar.
// Misma lógica que ejecutamos a mano: limpia claims/members, libera el place y
// borra el negocio si queda huérfano.
export async function unclaimPlace(formData: FormData) {
  await requireAdmin()
  const placeId = formData.get('place_id') as string
  if (!placeId) return { error: 'Falta el lugar' }
  const admin = createAdminClient()

  const { data: place } = await admin.from('places').select('business_id').eq('id', placeId).maybeSingle()
  const businessId = (place as { business_id: string | null } | null)?.business_id

  await admin.from('claims').delete().eq('place_id', placeId)
  await admin.from('places').update({ business_id: null, claimed: false, updated_at: new Date().toISOString() } as never).eq('id', placeId)

  if (businessId) {
    await admin.from('business_members').delete().eq('business_id', businessId)
    // borra el negocio sólo si ya no le queda ningún lugar
    const { count } = await admin.from('places').select('id', { count: 'exact', head: true }).eq('business_id', businessId)
    if (!count) await admin.from('businesses').delete().eq('id', businessId)
  }

  revalidatePath('/admin/claims')
  revalidatePath('/admin/places')
  return { success: true }
}
