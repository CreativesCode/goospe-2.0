'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'
import { complete, completeJson, type Usage } from '@/lib/ai/openai'
import { fireAndForget } from '@/lib/fire'

const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10
async function logUsage(feature: string, u: Usage, userId: string, businessId: string) {
  const admin = createAdminClient()
  fireAndForget(admin.from('ai_usage').insert({
    feature, model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
    input_tokens: u.input_tokens, output_tokens: u.output_tokens,
    cost_usd: COST(u), user_id: userId, business_id: businessId,
  } as never), `ai_usage:${feature}`)
}

async function ownerContext(placeId: string) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return null
  const admin = createAdminClient()
  const [{ data: place }, { data: biz }] = await Promise.all([
    admin.from('places').select('name, vibe_line, description, tags, price_level').eq('id', placeId).single(),
    admin.from('businesses').select('brand_voice').eq('id', businessId).maybeSingle(),
  ])
  return { user, businessId, place: place as Record<string, unknown>, brandVoice: (biz as { brand_voice: string | null } | null)?.brand_voice ?? null }
}

const PROMO_SCHEMA = {
  name: 'promo', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: { title: { type: 'string' }, description: { type: 'string' } },
    required: ['title', 'description'],
  },
}

// Genera el nombre + descripción de una promo/evento a partir de un brief del dueño.
export async function generatePromo(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const brief = ((formData.get('brief') as string) ?? '').trim()
  const ctx = await ownerContext(placeId)
  if (!ctx) return { error: 'Sin permiso' }

  const system = `Eres el community manager de un negocio local en Puerto Varas, Chile.
Escribe promos/eventos atractivos y honestos en español chileno cercano, listos para publicar.
${ctx.brandVoice ? `Tono de marca: ${ctx.brandVoice}.` : ''}
El título: corto y con gancho (máx 60 caracteres). La descripción: 2-3 frases, concreta, sin inventar
precios ni datos que no te den. No uses hashtags excesivos.`
  const user = `Negocio: ${JSON.stringify(ctx.place)}
Brief del dueño: "${brief || 'una promoción atractiva para esta semana'}"`

  try {
    const { data, usage } = await completeJson(system, user, PROMO_SCHEMA)
    await logUsage('promo', usage, ctx.user.id, ctx.businessId)
    return { success: true, ...(data as { title: string; description: string }) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// Sugiere una respuesta del dueño a una reseña.
export async function suggestReviewReply(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const reviewId = formData.get('review_id') as string
  const ctx = await ownerContext(placeId)
  if (!ctx) return { error: 'Sin permiso' }

  const admin = createAdminClient()
  const { data: review } = await admin.from('reviews').select('rating, body').eq('id', reviewId).maybeSingle()
  const r = review as { rating: number; body: string | null } | null
  if (!r) return { error: 'Reseña no encontrada' }

  const system = `Eres el dueño de un negocio local respondiendo una reseña en español chileno.
Responde con cortesía y cercanía, agradece, hazte cargo si la crítica es válida, e invita a volver.
${ctx.brandVoice ? `Tono de marca: ${ctx.brandVoice}.` : ''}
Breve (2-3 frases), humano, sin sonar a plantilla. No prometas compensaciones que no puedas cumplir.`
  const user = `Reseña (${r.rating}★): "${r.body ?? '(sin texto)'}"
Tu negocio: ${ctx.place.name}`

  try {
    const { text, usage } = await complete(system, user, { temperature: 0.7, maxTokens: 300 })
    await logUsage('review_reply', usage, ctx.user.id, ctx.businessId)
    return { success: true, reply: text }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
