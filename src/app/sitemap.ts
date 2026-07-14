import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goospe.com'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('places')
    .select('slug, updated_at')
    .eq('is_published', true)
    // No indexar fichas de lugares cerrados definitivos (NULL = sin dato → se indexa).
    .or('business_status.is.null,business_status.neq.CLOSED_PERMANENTLY')
    .order('name')
    .limit(5000)

  const places = ((data ?? []) as { slug: string; updated_at: string | null }[]).map((p) => ({
    url: `${BASE}/places/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const statics = ['', '/events', '/search', '/concierge', '/terms', '/privacy'].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : path === '/terms' || path === '/privacy' ? 0.3 : 0.8,
  }))

  return [...statics, ...places]
}
