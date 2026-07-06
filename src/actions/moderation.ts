'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return null
  return user
}

// Modera una reseña: 'approved' (visible) | 'blocked' (oculta).
export async function setReviewStatus(formData: FormData) {
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  if (!(await requireAdmin())) return { error: 'No autorizado' }
  if (!['approved', 'blocked'].includes(status)) return { error: 'Estado inválido' }

  const admin = createAdminClient()
  const { data: r } = await admin.from('reviews').select('place_id').eq('id', id).maybeSingle()
  const { error } = await admin.from('reviews').update({ status } as never).eq('id', id)
  if (error) return { error: error.message }
  // Recalcular el rating (el trigger sólo cuenta 'approved').
  const placeId = (r as { place_id: string } | null)?.place_id
  if (placeId) await admin.rpc('recompute_place_stats', { p_place: placeId } as never)
  revalidatePath('/admin/content')
  return { success: true }
}

// Modera un evento: 'approved' (visible) | 'rejected' (oculto).
export async function setEventStatus(formData: FormData) {
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  if (!(await requireAdmin())) return { error: 'No autorizado' }
  if (!['approved', 'rejected'].includes(status)) return { error: 'Estado inválido' }

  const admin = createAdminClient()
  const { error } = await admin.from('events').update({ status } as never).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/content')
  revalidatePath('/events')
  return { success: true }
}
