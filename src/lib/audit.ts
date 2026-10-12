import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import type { AuditObjectType } from '@/lib/audit-types'

export type AuditEntry = {
  userId: string
  /** Verbo en snake_case con prefijo de actor: owner.listing_update, admin.claim_reject… */
  action: string
  objectType: AuditObjectType
  objectId: string
  payload?: Record<string, unknown>
}

/**
 * Bitácora de acciones sensibles del dueño y del admin (tabla audit_log, solo service role).
 * Nunca lanza: un fallo de la bitácora no debe deshacer la acción que ya se hizo; queda en logs.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      user_id: entry.userId,
      action: entry.action,
      object_type: entry.objectType,
      object_id: entry.objectId,
      payload: (entry.payload ?? {}) as Json,
    })
    if (error) console.error(`[audit] ${entry.action}:`, error.message)
  } catch (e) {
    console.error(`[audit] ${entry.action}:`, (e as Error).message)
  }
}
