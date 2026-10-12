import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUBSCRIBABLE_CATEGORIES, isSubscribed, type PreferenceRow, type SubscribableCategory } from '@/lib/email/categories'

// Preferencias de email (tabla email_preferences, solo service role). Sin fila = suscrito.
// Quien llama ya validó la identidad: por sesión (panel) o por token firmado (enlace de baja).
type Admin = ReturnType<typeof createAdminClient>

export type PreferenceSource = 'link' | 'one_click' | 'panel'
export type PreferenceMap = Record<SubscribableCategory, boolean>

/** Estado de cada categoría para un usuario. Null si no se pudo leer. */
export async function loadPreferences(userId: string, admin: Admin = createAdminClient()): Promise<PreferenceMap | null> {
  const { data, error } = await admin.from('email_preferences').select('category, subscribed').eq('user_id', userId)
  if (error) {
    console.error('[email-preferences] leer:', error.message)
    return null
  }
  const rows = (data ?? []) as PreferenceRow[]
  return Object.fromEntries(SUBSCRIBABLE_CATEGORIES.map((c) => [c, isSubscribed(rows, c)])) as PreferenceMap
}

/**
 * De una lista de usuarios, los que SIGUEN suscritos a una categoría. Null si no se pudo leer
 * (quien llama no debe gastar ni enviar a ciegas).
 */
export async function subscribedUsers(
  userIds: string[], category: SubscribableCategory, admin: Admin = createAdminClient()
): Promise<Set<string> | null> {
  if (!userIds.length) return new Set()
  const { data, error } = await admin.from('email_preferences')
    .select('user_id').in('user_id', userIds).eq('category', category).eq('subscribed', false)
  if (error) {
    console.error('[email-preferences] leer:', error.message)
    return null
  }
  const out = new Set(userIds)
  for (const r of (data ?? []) as { user_id: string }[]) out.delete(r.user_id)
  return out
}

/** Guarda la baja o el alta de una categoría. Devuelve false si falló. */
export async function setSubscription(
  userId: string, category: SubscribableCategory, subscribed: boolean, source: PreferenceSource,
  admin: Admin = createAdminClient()
): Promise<boolean> {
  const { error } = await admin.from('email_preferences').upsert(
    { user_id: userId, category, subscribed, source, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,category' }
  )
  if (error) console.error('[email-preferences] guardar:', error.message)
  return !error
}
