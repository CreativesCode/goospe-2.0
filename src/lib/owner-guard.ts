import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { assertPlaceMembership } from '@/lib/ownership'
import { isUuid } from '@/lib/validation'

export type OwnerContext = { user: User; businessId: string; placeId: string }

/**
 * Puerta de toda server action del panel: sesión real + uuid válido + membresía del negocio
 * dueño del lugar. Devuelve el contexto o un error listo para mostrar.
 */
export async function requireOwner(placeId: unknown): Promise<OwnerContext | { error: string }> {
  if (!isUuid(placeId)) return { error: 'Lugar inválido' }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'No tienes permiso sobre este lugar' }
  return { user, businessId, placeId }
}
