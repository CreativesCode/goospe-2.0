'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { setMuted } from '@/lib/notification-prefs'
import { MUTE_GROUPS } from '@/features/notifications/kinds'

// Preferencias de avisos in-app del usuario en sesión. Marcar como leída NO pasa por aquí: el
// cliente del navegador ya puede escribir `read` en sus propias filas (RLS + grant por columna).
const schema = z.object({
  group: z.enum(MUTE_GROUPS),
  muted: z.enum(['0', '1']).transform((v) => v === '1'),
})

export async function setNotificationMute(formData: FormData) {
  const parsed = schema.safeParse({ group: formData.get('group'), muted: formData.get('muted') })
  if (!parsed.success) return { error: 'Preferencia inválida' }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  if (!(await rateLimit(`notif-pref:${user.id}`, 3600, 30))) return { error: 'Demasiados cambios seguidos. Intenta de nuevo en un rato.' }

  if (!(await setMuted(user.id, parsed.data.group, parsed.data.muted))) {
    return { error: 'No pudimos guardar tu preferencia. Intenta de nuevo.' }
  }
  revalidatePath('/profile/account')
  return { success: true, muted: parsed.data.muted }
}
