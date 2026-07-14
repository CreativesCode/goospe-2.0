import Link from 'next/link'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { createAdminClient } from '@/lib/supabase/admin'

// Grid de descubrimiento de Puerto Varas (cards de marca con foto aprobada cuando existe).
// Sin searchParams → ISR seguro (antes el toggle de debug `?photos=` la forzaba a dynamic).
export const revalidate = 3600

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

export default async function PlacesPage() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('places')
    .select(
      'id, slug, name, description, vibe_line, tags, price_level, address, place_photos(url, status), place_categories(categories(emoji, name))'
    )
    .eq('is_published', true)
    // Oculta lugares marcados como cerrados definitivos por Google (NULL = sin dato → visible).
    .or('business_status.is.null,business_status.neq.CLOSED_PERMANENTLY')
    .order('name')

  // Lanza para que lo capture src/app/error.tsx (UI amigable + reintento), no un crudo en rojo.
  if (error) throw new Error(error.message)
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
        </div>
      </div>

      {/* grid */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {places.map((p) => {
            const photo = p.place_photos?.find((ph) => ph.status === 'approved')?.url
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
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
        Datos: OSM + enriquecimiento IA (gpt-4o) + fotos Mapillary (CC-BY-SA)
      </footer>
    </main>
  )
}
