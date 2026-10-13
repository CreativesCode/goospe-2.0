import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActiveCity } from '@/lib/city-choice'

type Row = {
  id: number; slug: string; name: string; region: string | null; country: string
  timezone: string; lat: number; lng: number; places: number
}

/**
 * Ciudades activas con su centro y nº de lugares publicados (RPC active_cities, solo
 * service_role; migración 0043). Cacheado 1 h: cambia solo cuando se activa una zona.
 * Si la RPC falla devuelve [] y NO se cachea el fallo (lanza dentro del cache).
 */
const loadActiveCities = unstable_cache(
  async (): Promise<ActiveCity[]> => {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('active_cities')
    if (error) throw new Error(error.message)
    return ((data ?? []) as Row[]).map((r) => ({
      id: Number(r.id), slug: r.slug, name: r.name, region: r.region, country: r.country,
      timezone: r.timezone, lat: Number(r.lat), lng: Number(r.lng), places: Number(r.places),
    }))
  },
  ['active-cities-v1'],
  { revalidate: 3600, tags: ['cities'] }
)

export async function getActiveCities(): Promise<ActiveCity[]> {
  try {
    return await loadActiveCities()
  } catch (e) {
    console.error('[cities] active_cities falló:', (e as Error).message)
    return []
  }
}

export async function getActiveCityBySlug(slug: string): Promise<ActiveCity | null> {
  return (await getActiveCities()).find((c) => c.slug === slug) ?? null
}
