import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { normalizeDuplicates, rankDuplicates, type RankedDuplicate } from '@/features/admin/proposal-duplicates'

// Lecturas de la bandeja de propuestas con service role. SOLO llamar después de validar que
// quien pide es admin (requireAdmin / getAdminUser).
type Admin = ReturnType<typeof createAdminClient>

export type ProposalRow = {
  id: string; user_id: string; name: string; category_id: number | null; address: string | null
  city_id: number | null; city_name: string | null; lat: number | null; lng: number | null
  location_ref: string | null; phone: string | null; website: string | null; message: string | null
  status: string; reject_reason: string | null; place_id: string | null
  created_at: string; resolved_at: string | null
  categories: { name: string; emoji: string | null } | null
}

export const PROPOSAL_COLS =
  'id, user_id, name, category_id, address, city_id, city_name, lat, lng, location_ref, phone, website, message, status, reject_reason, place_id, created_at, resolved_at, categories(name, emoji)'

/**
 * Posibles duplicados de una propuesta. `ok: false` = no se pudo comprobar (p. ej. migración
 * 0039 sin aplicar): quien llama decide si deja seguir.
 */
export async function loadProposalDuplicates(
  admin: Admin,
  p: { name: string; lat: number | null; lng: number | null; cityId: number | null }
): Promise<{ ok: boolean; rows: RankedDuplicate[] }> {
  const { data, error } = await admin.rpc('place_proposal_duplicates', {
    p_name: p.name,
    ...(p.lat !== null && p.lng !== null ? { p_lat: p.lat, p_lng: p.lng } : {}),
    ...(p.cityId !== null ? { p_city_id: p.cityId } : {}),
  })
  if (error) {
    console.error('[loadProposalDuplicates]', error.message)
    return { ok: false, rows: [] }
  }
  return { ok: true, rows: rankDuplicates(normalizeDuplicates(data)) }
}
