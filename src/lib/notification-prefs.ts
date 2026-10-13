import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeMuted, toggleMuted, type MuteGroup } from '@/features/notifications/kinds'

// Preferencias de avisos in-app (tabla notification_preferences, 0042; solo service role).
// Quien llama ya validó la sesión: aquí el userId es siempre el del usuario en sesión.
// Sin la migración aplicada la tabla no existe: leer devuelve "nada silenciado" y guardar
// devuelve false; nunca lanza.
type AdminClient = ReturnType<typeof createAdminClient>

/** Grupos que el usuario silenció. */
export async function getMuted(userId: string, admin: AdminClient = createAdminClient()): Promise<MuteGroup[]> {
  const { data, error } = await admin.from('notification_preferences').select('muted').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('[notification-prefs] leer:', error.message)
    return []
  }
  return normalizeMuted((data as { muted: string[] } | null)?.muted)
}

/** Silencia o reactiva un grupo. Devuelve false si no se pudo guardar. */
export async function setMuted(userId: string, group: MuteGroup, muted: boolean): Promise<boolean> {
  const admin = createAdminClient()
  const next = toggleMuted(await getMuted(userId, admin), group, muted)
  const { error } = await admin.from('notification_preferences')
    .upsert({ user_id: userId, muted: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) console.error('[notification-prefs] guardar:', error.message)
  return !error
}

/** De una lista de usuarios, los que NO silenciaron el grupo. Ante un error no avisa a nadie. */
export async function withoutMuted(userIds: string[], group: MuteGroup, admin: AdminClient = createAdminClient()): Promise<string[]> {
  if (!userIds.length) return []
  const mutedBy = new Set<string>()
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await admin.from('notification_preferences')
      .select('user_id').in('user_id', userIds.slice(i, i + 200)).contains('muted', [group])
    if (error) {
      console.error('[notification-prefs] filtrar:', error.message)
      return []
    }
    for (const r of (data ?? []) as { user_id: string }[]) mutedBy.add(r.user_id)
  }
  return userIds.filter((id) => !mutedBy.has(id))
}
