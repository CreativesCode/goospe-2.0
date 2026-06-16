'use server'

import { createClient } from '@/lib/supabase/server'

// Reseñas: el usuario autenticado escribe la suya (1 por lugar, unique user_id+place_id).
// RLS "insert/update review" ya permite al dueño de la reseña. En el piloto se auto-aprueban
// (status='approved') para que se vean y alimenten el rating de inmediato; la moderación
// (status='pending'/'blocked') se puede activar después sin tocar este flujo.
export async function submitReview(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const rating = Number(formData.get('rating'))
  const body = ((formData.get('body') as string) ?? '').trim()

  if (!placeId) return { error: 'Falta el lugar' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Elige una calificación de 1 a 5' }
  if (body.length > 500) return { error: 'La reseña es muy larga (máx. 500)' }

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para opinar' }

  const { error } = await sb
    .from('reviews')
    .upsert(
      { user_id: user.id, place_id: placeId, rating, body: body || null, status: 'approved' } as never,
      { onConflict: 'user_id,place_id' }
    )
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteOwnReview(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await sb.from('reviews').delete().eq('user_id', user.id).eq('place_id', placeId)
  if (error) return { error: error.message }
  return { success: true }
}
