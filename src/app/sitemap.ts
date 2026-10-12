import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goospe.com'

export const dynamic = 'force-dynamic'

// La API de Supabase corta cada respuesta en 1.000 filas: se recorre con .range hasta agotar.
// Un sitemap admite 50.000 URLs; al acercarse a ese tope hay que partirlo con generateSitemaps.
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
      console.error('[sitemap] consulta falló:', error.message)
      break
    }
    const rows = (data ?? []) as PlaceRow[]
    out.push(...rows)
    if (rows.length < CHUNK) break
  }
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const places = (await allPublishedPlaces()).map((p) => ({
    url: `${BASE}/places/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const statics = ['', '/places', '/events', '/search', '/concierge', '/terms', '/privacy'].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : path === '/terms' || path === '/privacy' ? 0.3 : 0.8,
  }))

  return [...statics, ...places]
}
