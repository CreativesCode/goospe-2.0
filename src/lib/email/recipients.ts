import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailAddress } from '@/lib/email/send'

// Los emails viven en auth.users: se leen con el cliente admin (igual que /admin/users).
// Nunca lanzan: sin destinatario simplemente no hay envío.
type Admin = ReturnType<typeof createAdminClient>

export type Recipient = { userId: string; email: string }

/** Email de cada usuario (los que no tienen uno válido se omiten). */
export async function recipientsOf(userIds: string[], admin: Admin = createAdminClient()): Promise<Recipient[]> {
  const ids = [...new Set(userIds.filter(Boolean))]
  const found = await Promise.all(ids.map(async (userId) => {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error) {
        console.error('[email] no se pudo leer el usuario:', error.message)
        return null
      }
      const email = data.user?.email
      return isEmailAddress(email) ? { userId, email } : null
    } catch (e) {
      console.error('[email] no se pudo leer el usuario:', (e as Error).message)
      return null
    }
  }))
  return found.filter((r): r is Recipient => r !== null)
}

/** El equipo: todos los perfiles con is_admin (los mismos que reciben el aviso en la campana). */
export async function adminRecipients(admin: Admin = createAdminClient()): Promise<Recipient[]> {
  const { data, error } = await admin.from('profiles').select('id').eq('is_admin', true)
  if (error) {
    console.error('[email] no se pudo leer al equipo:', error.message)
    return []
  }
  return recipientsOf(((data ?? []) as { id: string }[]).map((p) => p.id), admin)
}

/** Miembros de un negocio. */
export async function businessMemberIds(businessId: string, admin: Admin = createAdminClient()): Promise<string[]> {
  const { data, error } = await admin.from('business_members').select('user_id').eq('business_id', businessId)
  if (error) {
    console.error('[email] no se pudo leer a los miembros:', error.message)
    return []
  }
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id)
}
