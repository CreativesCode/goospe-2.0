'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { revalidatePlace } from '@/lib/revalidate-place'
import { queueCriticalReviewAlerts } from '@/lib/email/hooks'
import { notifyUser } from '@/lib/notify'

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
  const { data: r } = await admin.from('reviews').select('place_id, user_id, status, places(name)').eq('id', id).maybeSingle()
  const { error } = await admin.from('reviews').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  // Recalcular el rating (el trigger sólo cuenta 'approved').
  const placeId = (r as { place_id: string } | null)?.place_id
  if (placeId) await admin.rpc('recompute_place_stats', { p_place: placeId })
  // Al aprobar una reseña de 1-2 estrellas el trigger avisa al negocio: su email sale aquí.
  if (placeId && status === 'approved') queueCriticalReviewAlerts(placeId)
  // Al autor: su reseña dejó de verse (solo al pasar a bloqueada, no en cada clic).
  const review = r as unknown as { user_id: string; status: string | null; places: { name: string } | null } | null
  if (review && status === 'blocked' && review.status !== 'blocked') {
    await notifyUser(review.user_id, {
      kind: 'review_blocked', title: 'Ocultamos tu reseña',
      body: `Tu reseña de ${review.places?.name ?? 'un lugar'} no cumple las normas de contenido y ya no es visible.`,
      link: '/profile/activity', placeId: placeId ?? null,
    })
  }
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
  const { data: ev } = await admin.from('events').select('place_id').eq('id', id).maybeSingle()
  const { error } = await admin.from('events').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/content')
  revalidatePath('/events')
  revalidatePath('/feed')
  // La ficha del lugar lista sus próximos eventos aprobados.
  const evPlaceId = (ev as { place_id: string } | null)?.place_id
  if (evPlaceId) await revalidatePlace(evPlaceId)
  return { success: true }
}
