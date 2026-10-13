'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { notifyAdmins, notifyBusiness } from '@/lib/notify'
import {
  categoryLabel, correctionSchema, firstIssue, generalFeedbackSchema,
} from '@/features/feedback/feedback-schema'

// Feedback general y "sugerir corrección" de un lugar. Lo puede enviar cualquiera:
//   · con sesión: tope por usuario;
//   · sin sesión: tope por IP (HMAC, nunca la IP en claro) que falla CERRADO —si el limitador
//     no responde, el envío anónimo se rechaza— y un campo trampa para bots.
// Se escribe con service role tras validar con Zod: la tabla no tiene acceso para anon ni
// authenticated. No modifica el lugar: solo deja el aviso en la bandeja de /admin/feedback.
const SEND_FAILED = 'No pudimos enviar tu mensaje. Intenta de nuevo.'
const TOO_MANY = 'Enviaste varios mensajes seguidos. Intenta de nuevo en un rato.'
const USER_PER_HOUR = 10
const ANON_PER_HOUR = 4

type Sender = { userId: string | null; key: string }

async function identifySender(): Promise<Sender> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  const key = clientKey(new Request('https://goospe.local', { headers: new Headers(await headers()) }))
  return { userId: user?.id ?? null, key }
}

const allowed = (sender: Sender) =>
  sender.userId
    ? rateLimit(`feedback:u:${sender.userId}`, 3600, USER_PER_HOUR)
    : rateLimit(`feedback:ip:${sender.key}`, 3600, ANON_PER_HOUR, { failOpen: false })

// Campo trampa: invisible para una persona; un bot lo rellena. Se responde "ok" sin guardar.
const isBot = (formData: FormData) => {
  const trap = formData.get('website')
  return typeof trap === 'string' && trap.trim() !== ''
}

export async function submitFeedback(formData: FormData) {
  if (isBot(formData)) return { success: true }
  const parsed = generalFeedbackSchema.safeParse({
    kind: 'general',
    category: formData.get('category'),
    message: formData.get('message'),
    contact_email: formData.get('contact_email'),
    page: formData.get('page'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const sender = await identifySender()
  if (!(await allowed(sender))) return { error: TOO_MANY }

  const fb = parsed.data
  const { error } = await createAdminClient().from('feedback').insert({
    kind: 'general', category: fb.category, message: fb.message,
    // Con sesión no se guarda email: ya se sabe quién escribe y, si elimina su cuenta, el
    // mensaje queda de verdad anónimo.
    contact_email: sender.userId ? null : fb.contact_email,
    page: fb.page, user_id: sender.userId, client_key: sender.key,
  })
  if (error) {
    console.error('[submitFeedback]', error.message)
    return { error: SEND_FAILED }
  }
  await notifyAdmins({
    kind: 'feedback_new', title: `Feedback: ${categoryLabel('general', fb.category)}`,
    body: fb.message, link: '/admin/feedback',
  })
  revalidatePath('/admin/feedback')
  return { success: true }
}

export async function suggestCorrection(formData: FormData) {
  if (isBot(formData)) return { success: true }
  const parsed = correctionSchema.safeParse({
    kind: 'correction',
    place_id: formData.get('place_id'),
    category: formData.get('category'),
    message: formData.get('message'),
    page: formData.get('page'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const sender = await identifySender()
  if (!(await allowed(sender))) return { error: TOO_MANY }

  const fb = parsed.data
  const admin = createAdminClient()
  const { data: placeRow } = await admin.from('places').select('id, name, business_id').eq('id', fb.place_id).maybeSingle()
  const place = placeRow as { id: string; name: string; business_id: string | null } | null
  if (!place) return { error: 'Lugar no encontrado' }

  const { error } = await admin.from('feedback').insert({
    kind: 'correction', category: fb.category, message: fb.message, place_id: place.id,
    page: fb.page, user_id: sender.userId, client_key: sender.key,
  })
  if (error) {
    console.error('[suggestCorrection]', error.message)
    return { error: SEND_FAILED }
  }

  const what = categoryLabel('correction', fb.category)
  const notice = { title: `Sugerencia de corrección: ${place.name}`, body: fb.message ? `${what} · ${fb.message}` : what, placeId: place.id }
  await notifyAdmins({ ...notice, kind: 'feedback_new', link: '/admin/feedback' })
  // Si el lugar tiene dueño, también le llega (sin contarle quién la envió). No se avisa a sí mismo.
  if (place.business_id) {
    await notifyBusiness(place.business_id, { ...notice, kind: 'place_correction', link: `/panel/${place.id}` }, sender.userId ?? undefined)
  }
  revalidatePath('/admin/feedback')
  return { success: true }
}
