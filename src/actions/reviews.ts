'use server'

import { createClient } from '@/lib/supabase/server'
import { containsProfanity } from '@/lib/profanity'

// Reseñas: el usuario autenticado escribe la suya (1 por lugar, unique user_id+place_id).
// RLS "insert/update review" ya permite al dueño de la reseña. En el piloto se auto-aprueban
// (status='approved') para que se vean y alimenten el rating de inmediato, con guardas mínimas:
// filtro de groserías + rate-limit anti-spam. La moderación reactiva (ocultar/bloquear) sigue
// disponible en /admin/content sin tocar este flujo.
const REVIEW_RATE_WINDOW_MIN = 10 // ventana de rate-limit
const REVIEW_RATE_MAX = 5 // máx. reseñas nuevas por usuario en la ventana

export async function submitReview(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const rating = Number(formData.get('rating'))
  const body = ((formData.get('body') as string) ?? '').trim()

  if (!placeId) return { error: 'Falta el lugar' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Elige una calificación de 1 a 5' }
  if (body.length > 500) return { error: 'La reseña es muy larga (máx. 500)' }
  if (containsProfanity(body)) return { error: 'Evita lenguaje ofensivo en tu reseña' }

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para opinar' }

  // Rate-limit: cuenta reseñas recientes del usuario para frenar spam.
  const since = new Date(Date.now() - REVIEW_RATE_WINDOW_MIN * 60_000).toISOString()
  const { count } = await sb
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= REVIEW_RATE_MAX) return { error: 'Vas muy rápido. Intenta de nuevo en unos minutos.' }

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
