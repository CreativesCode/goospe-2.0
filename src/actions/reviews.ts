'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { containsProfanity } from '@/lib/profanity'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validation'

// Reseñas: el usuario autenticado escribe la suya (1 por lugar, unique user_id+place_id).
// En el piloto se auto-aprueban (status='approved') para que se vean y alimenten el rating de
// inmediato, con guardas mínimas: filtro de groserías + rate-limit anti-spam. Se escribe con
// service role DESPUÉS de validar sesión y contenido: lo que entre por la API directa lo frena
// el trigger trg_reviews_guard (0033/0034). La moderación reactiva (ocultar/bloquear) sigue
// disponible en /admin/content sin tocar este flujo.
const REVIEW_RATE_WINDOW_S = 600 // ventana de rate-limit (10 min)
const REVIEW_RATE_MAX = 5 // máx. reseñas nuevas por usuario en la ventana
const SAVE_FAILED = 'No pudimos guardar tu reseña. Intenta de nuevo.'

export async function submitReview(formData: FormData) {
  const placeId = formData.get('place_id')
  const rating = Number(formData.get('rating'))
  const rawBody = formData.get('body')
  const body = (typeof rawBody === 'string' ? rawBody : '').trim()

  if (!isUuid(placeId)) return { error: 'Falta el lugar' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Elige una calificación de 1 a 5' }
  if (body.length > 500) return { error: 'La reseña es muy larga (máx. 500)' }
  if (containsProfanity(body)) return { error: 'Evita lenguaje ofensivo en tu reseña' }

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para opinar' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('reviews').select('id, status').eq('user_id', user.id).eq('place_id', placeId).maybeSingle()
  const prev = existing as { id: string; status: string } | null

  if (prev) {
    // Edición: no cuenta para el rate-limit. El autor no revierte la moderación: una reseña
    // bloqueada u oculta conserva su estado.
    const patch = prev.status === 'pending'
      ? { rating, body: body || null, status: 'approved' }
      : { rating, body: body || null }
    const { error } = await admin.from('reviews').update(patch as never).eq('id', prev.id)
    if (error) {
      console.error('[submitReview] update:', error.message)
      return { error: SAVE_FAILED }
    }
    return { success: true }
  }

  // Rate-limit con contador persistente (borrar reseñas no lo reinicia). Misma clave que el trigger.
  if (!(await rateLimit(`review:${user.id}`, REVIEW_RATE_WINDOW_S, REVIEW_RATE_MAX))) {
    return { error: 'Vas muy rápido. Intenta de nuevo en unos minutos.' }
  }

  // ignoreDuplicates: si dos envíos simultáneos compiten, el segundo no pisa nada.
  const { error } = await admin
    .from('reviews')
    .upsert(
      { user_id: user.id, place_id: placeId, rating, body: body || null, status: 'approved' } as never,
      { onConflict: 'user_id,place_id', ignoreDuplicates: true }
    )
  if (error) {
    // 23503: el lugar no existe. El resto no se devuelve crudo al cliente.
    console.error('[submitReview] insert:', error.message)
    return { error: error.code === '23503' ? 'Lugar no encontrado' : SAVE_FAILED }
  }
  return { success: true }
}

export async function deleteOwnReview(formData: FormData) {
  const placeId = formData.get('place_id')
  if (!isUuid(placeId)) return { error: 'Falta el lugar' }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Con el cliente del usuario: la política "delete review" sólo deja borrar la propia y no bloqueada.
  const { error } = await sb.from('reviews').delete().eq('user_id', user.id).eq('place_id', placeId)
  if (error) {
    console.error('[deleteOwnReview]', error.message)
    return { error: 'No pudimos eliminar tu reseña. Intenta de nuevo.' }
  }
  return { success: true }
}
