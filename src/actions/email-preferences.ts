'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { SUBSCRIBABLE_CATEGORIES } from '@/lib/email/categories'
import { setSubscription } from '@/lib/email/preferences'
import { readUnsubscribeToken } from '@/lib/email/tokens'

// Preferencias de email. Dos puertas, las dos validadas en el servidor:
//   · por token firmado (enlace de baja de un email): sin sesión, solo toca la categoría y el
//     usuario que van dentro del token;
//   · por sesión (panel del dueño): solo las del propio usuario.
const SAVE_FAILED = 'No pudimos guardar tu preferencia. Intenta de nuevo.'
const flag = z.enum(['0', '1']).transform((v) => v === '1')

const byTokenSchema = z.object({ token: z.string().min(1).max(1024), subscribed: flag })
const bySessionSchema = z.object({ category: z.enum(SUBSCRIBABLE_CATEGORIES), subscribed: flag })

/** Baja o re-alta desde la página pública /unsubscribe. */
export async function setSubscriptionByToken(formData: FormData) {
  const parsed = byTokenSchema.safeParse({ token: formData.get('token'), subscribed: formData.get('subscribed') })
  if (!parsed.success) return { error: 'Enlace inválido' }
  const target = readUnsubscribeToken(parsed.data.token)
  if (!target) return { error: 'Este enlace no es válido. Abre el del email más reciente.' }
  if (!(await rateLimit(`email-pref:${target.userId}`, 3600, 30))) return { error: 'Demasiados cambios seguidos. Intenta de nuevo en un rato.' }

  const ok = await setSubscription(target.userId, target.category, parsed.data.subscribed, 'link')
  return ok ? { success: true, subscribed: parsed.data.subscribed } : { error: SAVE_FAILED }
}

/** Interruptor de una categoría desde el panel (usuario en sesión). */
export async function updateEmailPreference(formData: FormData) {
  const parsed = bySessionSchema.safeParse({ category: formData.get('category'), subscribed: formData.get('subscribed') })
  if (!parsed.success) return { error: 'Preferencia inválida' }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  if (!(await rateLimit(`email-pref:${user.id}`, 3600, 30))) return { error: 'Demasiados cambios seguidos. Intenta de nuevo en un rato.' }

  const ok = await setSubscription(user.id, parsed.data.category, parsed.data.subscribed, 'panel')
  if (!ok) return { error: SAVE_FAILED }
  revalidatePath('/panel')
  return { success: true, subscribed: parsed.data.subscribed }
}
