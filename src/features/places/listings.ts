import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { pageOffset } from '@/lib/pagination'
import type { PlaceCardData } from '@/features/places/PlaceCard'

// Datos de los listados SEO (/places, /c/[ciudad], /c/[ciudad]/[categoria]) y de los bloques
// "Populares en …" y "Lugares relacionados". Todo sale de RPC de la migración 0041 (solo
// service_role). `cache()` comparte la consulta entre generateMetadata y el render.

export const LISTING_PAGE_SIZE = 24

export type ListingCategory = { id: number; slug: string; name: string; emoji: string | null; places: number }
export type ListingCity = {
  id: number
  slug: string
  name: string
  region: string | null
  country: string
  timezone: string
  places: number
  categories: ListingCategory[]
}

type CityRow = Omit<ListingCity, 'places' | 'categories'>
type CategoryRow = Omit<ListingCategory, 'places'> & { sort: number | null }

/**
 * Ciudades activas con al menos un lugar publicado, con su desglose por categoría.
 * Lanza si la consulta falla: un directorio vacío en caché sería peor que un error visible.
 */
export const getCityDirectory = cache(async (): Promise<ListingCity[]> => {
  const sb = createAdminClient()
  const [cities, categories, counts] = await Promise.all([
    sb.from('cities').select('id, slug, name, region, country, timezone').eq('is_active', true).order('name'),
    sb.from('categories').select('id, slug, name, emoji, sort').eq('enabled', true).order('sort'),
    sb.rpc('city_category_counts'),
  ])
  const failed = cities.error ?? categories.error ?? counts.error
  if (failed) throw new Error(`[listings] directorio de ciudades: ${failed.message}`)

  const cats = (categories.data ?? []) as CategoryRow[]
  const byCity = new Map<number, Map<number, number>>()
  for (const row of counts.data ?? []) {
    const inner = byCity.get(Number(row.city_id)) ?? new Map<number, number>()
    inner.set(Number(row.category_id), Number(row.places))
    byCity.set(Number(row.city_id), inner)
  }

  return ((cities.data ?? []) as CityRow[])
    .map((city) => {
      const inner = byCity.get(Number(city.id)) ?? new Map<number, number>()
      const withPlaces = cats
        .map(({ id, slug, name, emoji }) => ({ id, slug, name, emoji, places: inner.get(Number(id)) ?? 0 }))
        .filter((c) => c.places > 0)
      // Hoy cada lugar tiene una sola categoría, así que la suma es el total de la ciudad.
      return { ...city, places: withPlaces.reduce((sum, c) => sum + c.places, 0), categories: withPlaces }
    })
    .filter((city) => city.places > 0)
})

export async function getCityBySlug(slug: string): Promise<ListingCity | null> {
  return (await getCityDirectory()).find((c) => c.slug === slug) ?? null
}

/** Ciudades agrupadas por país, las más grandes primero (índice de /places y pie de listados). */
export function groupByCountry(cities: ListingCity[]): { country: string; cities: ListingCity[] }[] {
  const groups = new Map<string, ListingCity[]>()
  for (const city of cities) groups.set(city.country, [...(groups.get(city.country) ?? []), city])
  return [...groups.entries()]
    .map(([country, list]) => ({ country, cities: [...list].sort((a, b) => b.places - a.places) }))
    .sort((a, b) => a.country.localeCompare(b.country, 'es'))
}

type RpcPlace = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  price_level: number | null
  photo_url: string | null
  category_name: string | null
  category_emoji: string | null
  rating: number
  distance_m?: number
}

const toCard = (r: RpcPlace): PlaceCardData => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  photo_url: r.photo_url,
  category_name: r.category_name,
  category_emoji: r.category_emoji,
  price_level: r.price_level,
  vibe_line: r.vibe_line,
  rating: Number(r.rating) || 0,
  distance_m: r.distance_m ?? null,
})

/** Una página del listado (orden alfabético, estable entre páginas) y el total de lugares. */
export const getCityPlaces = cache(async (cityId: number, categoryId: number | null, page: number) => {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('city_places', {
    p_city_id: cityId,
    p_category_id: categoryId,
    p_sort: 'name',
    p_limit: LISTING_PAGE_SIZE,
    p_offset: pageOffset(page, LISTING_PAGE_SIZE),
  })
  if (error) throw new Error(`[listings] city_places: ${error.message}`)
  const rows = data ?? []
  return { places: rows.map(toCard), total: Number(rows[0]?.total ?? 0) }
})

/** Bloque "Populares en {ciudad}". Si falla, el bloque no se pinta (no tumba el listado). */
export async function getPopularPlaces(cityId: number, categoryId: number | null, limit = 4): Promise<PlaceCardData[]> {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('city_places', {
    p_city_id: cityId, p_category_id: categoryId, p_sort: 'popular', p_limit: limit, p_offset: 0,
  })
  if (error) {
    console.error('[listings] populares:', error.message)
    return []
  }
  return (data ?? []).map(toCard)
}

/** Bloque "Lugares relacionados" de la ficha. Si falla (p. ej. 0041 sin aplicar), no se pinta. */
export async function getRelatedPlaces(placeId: string, limit = 4): Promise<PlaceCardData[]> {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('related_places', { p_place_id: placeId, p_limit: limit })
  if (error) {
    console.error('[listings] relacionados:', error.message)
    return []
  }
  // La distancia que devuelve el RPC es respecto de ESTE lugar, no del visitante: no se pinta
  // en la card (se leería como "a X m de ti").
  return (data ?? []).map((r) => ({ ...toCard(r), distance_m: null }))
}
