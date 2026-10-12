'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/owner-guard'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePlace } from '@/lib/revalidate-place'
import { audit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { isUuid } from '@/lib/validation'
import { firstIssue } from '@/features/business/listing-schema'
import { reviewReplySchema } from '@/features/business/owner-schemas'

// Respuesta pública del negocio a una reseña (una por reseña; se puede editar y borrar).
// reviews.owner_reply solo lo escribe el servidor: por la API el autor de la reseña no tiene
// permiso sobre esa columna (0037).
const REPLIES_PER_HOUR = 40
const SAVE_FAILED = 'No pudimos publicar la respuesta. Intenta de nuevo.'

type ReviewRow = { id: string; user_id: string; owner_reply: string | null; status: string | null }
type AdminClient = ReturnType<typeof createAdminClient>

// La reseña debe pertenecer al lugar cuya membresía se validó.
async function findReview(admin: AdminClient, reviewId: string, placeId: string): Promise<ReviewRow | null> {
  const { data } = await admin.from('reviews').select('id, user_id, owner_reply, status')
    .eq('id', reviewId).eq('place_id', placeId).maybeSingle()
  return data as ReviewRow | null
}

export async function saveReviewReply(formData: FormData) {
  const reviewId = formData.get('review_id')
  if (!isUuid(reviewId)) return { error: 'Reseña inválida' }
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const parsed = reviewReplySchema.safeParse({ body: formData.get('body') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!(await rateLimit(`review-reply:${ctx.user.id}`, 3600, REPLIES_PER_HOUR))) {
    return { error: 'Vas muy rápido. Intenta de nuevo en un rato.' }
  }

  const admin = createAdminClient()
  const review = await findReview(admin, reviewId, ctx.placeId)
  if (!review || review.status !== 'approved') return { error: 'Reseña no encontrada' }

  const repliedAt = new Date().toISOString()
  const { error } = await admin.from('reviews')
    .update({ owner_reply: parsed.data.body, owner_replied_at: repliedAt, owner_reply_by: ctx.user.id })
    .eq('id', review.id).eq('place_id', ctx.placeId)
  if (error) {
    console.error('[saveReviewReply]', error.message)
    return { error: SAVE_FAILED }
  }

  const { data: placeRow } = await admin.from('places').select('slug, name').eq('id', ctx.placeId).maybeSingle()
  const place = placeRow as { slug: string; name: string } | null
  // Solo se avisa al autor la primera vez (editar la respuesta no vuelve a notificar).
  if (!review.owner_reply && place && review.user_id !== ctx.user.id) {
    await notifyUser(review.user_id, {
      kind: 'review_reply',
      title: `${place.name} respondió tu reseña`,
      body: parsed.data.body,
      link: `/places/${place.slug}#resenas`,
      placeId: ctx.placeId,
    })
  }

  await audit({
    userId: ctx.user.id, action: review.owner_reply ? 'owner.review_reply_edit' : 'owner.review_reply',
    objectType: 'review', objectId: review.id,
    payload: { place_id: ctx.placeId, before: review.owner_reply, after: parsed.data.body },
  })
  revalidatePath(`/panel/${ctx.placeId}`)
  await revalidatePlace(ctx.placeId, place?.slug)
  return { success: true, reply: parsed.data.body, repliedAt }
}

export async function deleteReviewReply(formData: FormData) {
  const reviewId = formData.get('review_id')
  if (!isUuid(reviewId)) return { error: 'Reseña inválida' }
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const admin = createAdminClient()
  const review = await findReview(admin, reviewId, ctx.placeId)
  if (!review) return { error: 'Reseña no encontrada' }
  if (!review.owner_reply) return { success: true }

  const { error } = await admin.from('reviews')
    .update({ owner_reply: null, owner_replied_at: null, owner_reply_by: null })
    .eq('id', review.id).eq('place_id', ctx.placeId)
  if (error) {
    console.error('[deleteReviewReply]', error.message)
    return { error: 'No pudimos borrar la respuesta. Intenta de nuevo.' }
  }

  await audit({
    userId: ctx.user.id, action: 'owner.review_reply_delete', objectType: 'review', objectId: review.id,
    payload: { place_id: ctx.placeId, before: review.owner_reply },
  })
  revalidatePath(`/panel/${ctx.placeId}`)
  await revalidatePlace(ctx.placeId)
  return { success: true }
}
