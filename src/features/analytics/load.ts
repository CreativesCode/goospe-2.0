import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRows, type Group, type RangeDays, type SeriesRow } from '@/features/analytics/metrics'

// Lectura de agregados del dueño. SOLO llamar después de validar la membresía del lugar
// (assertPlaceMembership / requireOwner): las RPC son service_role y no comprueban dueño.

export type BoostStat = {
  boost_id: string
  starts_at: string
  ends_at: string
  ended_at: string | null
  status: string | null
  impressions: number
  clicks: number
  actions: number
}

/** Serie de métricas del lugar; `ok: false` si la RPC falla (p. ej. migración sin aplicar). */
export async function loadPlaceSeries(placeId: string, days: RangeDays, group: Group): Promise<{ ok: boolean; rows: SeriesRow[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('place_metrics_series', { p_place_id: placeId, p_days: days, p_group: group })
  if (error) {
    console.error('[loadPlaceSeries]', error.message)
    return { ok: false, rows: [] }
  }
  return { ok: true, rows: normalizeRows(data) }
}

/** Rendimiento de los boosts del lugar (impresiones, clics y acciones mientras estuvo activo). */
export async function loadBoostStats(placeId: string): Promise<BoostStat[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('place_boost_stats', { p_place_id: placeId })
  if (error) {
    console.error('[loadBoostStats]', error.message)
    return []
  }
  return ((data ?? []) as BoostStat[]).map((b) => ({
    ...b, impressions: Number(b.impressions), clicks: Number(b.clicks), actions: Number(b.actions),
  }))
}
