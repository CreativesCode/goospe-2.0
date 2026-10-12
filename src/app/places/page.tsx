import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { PhotoImg } from '@/shared/components/photo-img'
import { createAdminClient } from '@/lib/supabase/admin'

// Grid de descubrimiento de lugares (cards de marca con foto aprobada cuando existe).
// Paginado en la BD con `?page=`: antes traía el catálogo entero en una sola respuesta
// (truncada a 1.000 filas por la API y de ~5 MB de HTML).
const PAGE = 48

export const metadata: Metadata = {
  title: 'Lugares | Goospe',
  description: 'Todos los lugares de Goospe: dónde comer, tomar café, salir de noche y más.',
}

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

const pageHref = (n: number) => (n <= 1 ? '/places' : `/places?page=${n}`)

export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams
  const reqPage = Math.max(1, Math.floor(Number(sp.page)) || 1)
  const from = (reqPage - 1) * PAGE

  const sb = createAdminClient()
  const { data, error, count } = await sb
    .from('places')
    .select(
      'id, slug, name, description, vibe_line, tags, price_level, address, place_photos(url, status), place_categories(categories(emoji, name))',
      { count: 'exact' }
    )
    .eq('is_published', true)
    // Oculta lugares marcados como cerrados definitivos por Google (NULL = sin dato → visible).
    .or('business_status.is.null,business_status.neq.CLOSED_PERMANENTLY')
    .order('name')
    .order('id') // desempate: sin él, dos lugares con el mismo nombre saltan entre páginas
    .range(from, from + PAGE - 1)

  // Página fuera de rango (la API responde 416) → a la primera, no a un "0 lugares".
  if (reqPage > 1 && (error || !data?.length)) redirect('/places')
  // Lanza para que lo capture src/app/error.tsx (UI amigable + reintento), no un crudo en rojo.
  if (error) throw new Error(error.message)
  const places = (data ?? []) as unknown as PlaceRow[]
  const total = count ?? places.length
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-fg-soft">
          <span>
            <strong className="text-fg">{total.toLocaleString('es-CL')}</strong> lugares
          </span>
          {pages > 1 && <span>Página {reqPage} de {pages}</span>}
        </div>
      </div>

      {/* grid */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8">
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
                {/* media: foto, o gradiente + icono de categoría si no hay o no carga */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <PhotoImg
                    src={photo}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    fallback={<Cat size={44} strokeWidth={1.5} />}
                  />
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

        {pages > 1 && (
          <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-3 text-sm">
            {reqPage > 1 ? (
              <Link href={pageHref(reqPage - 1)} rel="prev" className="rounded-full border border-line bg-card px-4 py-2 font-medium text-fg-soft transition hover:text-fg">
                Anterior
              </Link>
            ) : <span className="rounded-full border border-line px-4 py-2 text-muted opacity-50">Anterior</span>}
            <span className="text-muted">Página {reqPage} de {pages}</span>
            {reqPage < pages ? (
              <Link href={pageHref(reqPage + 1)} rel="next" className="rounded-full border border-line bg-card px-4 py-2 font-medium text-fg-soft transition hover:text-fg">
                Siguiente
              </Link>
            ) : <span className="rounded-full border border-line px-4 py-2 text-muted opacity-50">Siguiente</span>}
          </nav>
        )}
      </div>

      <footer className="mt-auto border-t border-line pb-24 pt-6 text-center text-xs text-muted md:pb-6">
        Datos: OSM + enriquecimiento IA (gpt-4o) + fotos Mapillary (CC-BY-SA)
      </footer>
    </main>
  )
}
