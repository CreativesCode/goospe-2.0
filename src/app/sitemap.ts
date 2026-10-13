import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCityDirectory } from '@/features/places/listings'
import { cityCategoryPath, cityPath, eventPath, placePath } from '@/features/places/seo-routes'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goospe.com').replace(/\/+$/, '')

// Se regenera cada hora (antes se recalculaba en cada visita de un rastreador).
export const revalidate = 3600

// La API de Supabase corta cada respuesta en 1.000 filas: se recorre con .range hasta agotar.
// Un sitemap admite 50.000 URLs y hoy hay ~3.700 lugares: cabe en un solo archivo. Al acercarse
// al tope hay que partirlo con generateSitemaps (y listar cada parte en robots.ts, porque Next
// no genera el índice).
const CHUNK = 1000
const MAX_URLS = 45000

type PlaceRow = { slug: string; updated_at: string | null }

async function allPublishedPlaces(): Promise<PlaceRow[]> {
  const sb = createAdminClient()
  const out: PlaceRow[] = []
  for (let from = 0; from < MAX_URLS; from += CHUNK) {
    const { data, error } = await sb
      .from('places')
      .select('slug, updated_at')
      .eq('is_published', true)
      // No indexar fichas de lugares cerrados definitivos (NULL = sin dato → se indexa).
      .or('business_status.is.null,business_status.neq.CLOSED_PERMANENTLY')
      .order('id') // orden total y estable entre páginas
      .range(from, from + CHUNK - 1)
    if (error) {
      console.error('[sitemap] lugares:', error.message)
      break
    }
    const rows = (data ?? []) as PlaceRow[]
    out.push(...rows)
    if (rows.length < CHUNK) break
  }
  return out
}

// Listados por ciudad y por ciudad + categoría (solo la primera página de cada uno: el resto
// se descubre por los enlaces de paginación).
async function listingUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const cities = await getCityDirectory()
    return cities.flatMap((city) => [
      { url: `${BASE}${cityPath(city.slug)}`, changeFrequency: 'daily' as const, priority: 0.8 },
      ...city.categories.map((c) => ({
        url: `${BASE}${cityCategoryPath(city.slug, c.slug)}`,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ])
  } catch (e) {
    console.error('[sitemap] listados:', (e as Error).message)
    return []
  }
}

// Eventos aprobados de lugares publicados: los que vienen y los del último mes (su página
// sigue existiendo con el estado "ya pasó").
async function eventUrls(): Promise<MetadataRoute.Sitemap> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('events')
    .select('id, starts_at, places!inner(is_published)')
    .eq('status', 'approved')
    .eq('places.is_published', true)
    .gte('starts_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .order('starts_at')
    .limit(1000)
  if (error) {
    console.error('[sitemap] eventos:', error.message)
    return []
  }
  const now = Date.now()
  return (data ?? []).map((ev) => {
    const upcoming = new Date(ev.starts_at).getTime() >= now
    return {
      url: `${BASE}${eventPath(ev.id)}`,
      changeFrequency: upcoming ? ('daily' as const) : ('monthly' as const),
      priority: upcoming ? 0.7 : 0.3,
    }
  })
}

const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: '', priority: 1 },
  { path: '/places', priority: 0.8 },
  { path: '/events', priority: 0.8 },
  { path: '/search', priority: 0.8 },
  { path: '/concierge', priority: 0.8 },
  { path: '/about', priority: 0.4 },
  { path: '/help', priority: 0.4 },
  { path: '/contact', priority: 0.4 },
  { path: '/terms', priority: 0.3 },
  { path: '/privacy', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, listings, events] = await Promise.all([allPublishedPlaces(), listingUrls(), eventUrls()])

  const statics = STATIC_PATHS.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'daily' as const,
    priority,
  }))
  const placeEntries = places.map((p) => ({
    url: `${BASE}${placePath(p.slug)}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...statics, ...listings, ...events, ...placeEntries]
}
