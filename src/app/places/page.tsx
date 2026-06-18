import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createAdminClient } from '@/lib/supabase/admin'

// Página TEMPORAL de validación: muestra los lugares de Puerto Varas con los datos que tenemos
// (enriquecimiento IA + foto de fachada Mapillary). No es la UI final del feed.
export const dynamic = 'force-dynamic'

type PlaceRow = {
  id: string
  slug: string
  name: string
  description: string | null
  vibe_line: string | null
  tags: string[] | null
  price_level: number | null
  address: { city?: string; formatted?: string } | null
  place_photos: { url: string; status: string | null }[]
  place_categories: { categories: { emoji: string | null; name: string } | null }[]
}

function Price({ level }: { level: number | null }) {
  if (!level) return null
  return (
    <span className="text-sm font-medium">
      <span className="text-fg">{'$'.repeat(level)}</span>
      <span className="text-muted/50">{'$'.repeat(4 - level)}</span>
    </span>
  )
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ photos?: string }>
}) {
  // Por defecto: cards de marca (cold-start honesto). ?photos=1 → muestra la fachada
  // Mapillary (street-level, tipo dashcam) solo para comparar; no es la foto final.
  const showPhotos = (await searchParams).photos === '1'
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('places')
    .select(
      'id, slug, name, description, vibe_line, tags, price_level, address, place_photos(url, status), place_categories(categories(emoji, name))'
    )
    .eq('is_published', true)
    .order('name')

  if (error) {
    return <main className="p-10 text-red-600">Error: {error.message}</main>
  }
  const places = (data ?? []) as unknown as PlaceRow[]
  const withPhoto = places.filter((p) => p.place_photos?.length).length

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-fg-soft">
          <span>
            Puerto Varas · <strong className="text-fg">{places.length}</strong> lugares ·{' '}
            <span className="text-goospe-green">{withPhoto}</span> con foto
          </span>
          <a
            href={showPhotos ? '/places' : '/places?photos=1'}
            className="inline-flex items-center gap-1.5 rounded-full border border-goospe-green/40 px-3 py-1 text-xs font-medium text-goospe-green-dark transition hover:bg-goospe-green/10"
          >
            {showPhotos ? <><ArrowLeft size={12} strokeWidth={1.75} /> cards de marca</> : <>ver fachadas Mapillary <ArrowRight size={12} strokeWidth={1.75} /></>}
          </a>
        </div>
      </div>

      {/* grid */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {places.map((p) => {
            // Por defecto solo fotos aprobadas (buenas); con ?photos=1 cualquiera (incl. street pending).
            const approved = p.place_photos?.find((ph) => ph.status === 'approved')?.url
            const photo = showPhotos ? p.place_photos?.[0]?.url : approved
            const Cat = categoryIcon(p.place_categories?.[0]?.categories?.emoji)
            const city = p.address?.city ?? null
            return (
              <Link
                href={`/places/${p.slug}`}
                key={p.id}
                className="group block overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
              >
                {/* media */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={p.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      {showPhotos && (
                        <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                          street
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center bg-goospe-gradient text-white">
                      <Cat size={44} strokeWidth={1.5} />
                      <img
                        src="/brand/isotipo-white.svg"
                        alt=""
                        className="absolute bottom-2 right-2 h-6 w-6 opacity-70"
                      />
                    </div>
                  )}
                  {!photo && (
                    <span className="absolute left-3 top-3 flex items-center justify-center rounded-full bg-card/90 p-2 text-fg shadow-sm">
                      <Cat size={16} strokeWidth={1.75} />
                    </span>
                  )}
                </div>

                {/* body */}
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium leading-tight text-fg">{p.name}</h2>
                    <Price level={p.price_level} />
                  </div>
                  {p.vibe_line && <p className="text-sm font-medium text-goospe-green">{p.vibe_line}</p>}
                  {p.description && (
                    <p className="line-clamp-3 text-sm leading-snug text-fg-soft">{p.description}</p>
                  )}
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-goospe-green/10 px-2 py-0.5 text-xs text-goospe-green-dark"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {city && <p className="pt-1 text-xs text-muted">{city}</p>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <footer className="mt-auto border-t border-line pb-24 pt-6 text-center text-xs text-muted md:pb-6">
        Vista temporal de validación · datos: OSM + enriquecimiento IA (gpt-4o) + fotos Mapillary (CC-BY-SA)
      </footer>
    </main>
  )
}
