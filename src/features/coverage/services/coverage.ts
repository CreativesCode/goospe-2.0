import { createClient } from '@/lib/supabase/client'

// Ciudad activa que cubre una coordenada (resultado de la RPC resolve_coverage).
export type CoverageCity = {
  cityId: number
  slug: string
  name: string
  distanceM: number
}

type CoverageRow = { city_id: number; slug: string; name: string; distance_m: number }

/**
 * Resuelve si una coordenada cae dentro de una ciudad ACTIVA (RPC PostGIS resolve_coverage).
 * Devuelve la ciudad más cercana que la cubre, o null si está fuera de toda cobertura.
 */
export async function resolveCoverage(lat: number, lng: number): Promise<CoverageCity | null> {
  const supabase = createClient()
  // `as never` en los args: workaround del tipado de rpc de supabase-js (igual que use-feed.ts).
  const { data, error } = await supabase.rpc('resolve_coverage', { p_lat: lat, p_lng: lng } as never)
  if (error) throw error
  const row = ((data ?? []) as CoverageRow[])[0]
  if (!row) return null
  return { cityId: row.city_id, slug: row.slug, name: row.name, distanceM: row.distance_m }
}

export type ActiveCity = { id: number; name: string; region: string | null; country: string }

// Ciudades actualmente cubiertas (is_active). Lectura pública (RLS "read cities").
export async function getActiveCities(): Promise<ActiveCity[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('cities')
    .select('id, name, region, country')
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as ActiveCity[]
}
