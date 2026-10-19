import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { absoluteUrl } from '@/lib/email/config'
import { pageCount, pageHref, pageOffset } from '@/lib/pagination'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { Breadcrumbs, type Crumb } from '@/shared/components/breadcrumbs'
import { JsonLd } from '@/shared/components/json-ld'
import { Pagination } from '@/shared/components/pagination'
import { categoryIcon } from '@/shared/lib/icons'
import { pageShell, pageTitle, pill } from '@/shared/lib/ui'
import { PlaceCard } from '@/features/places/PlaceCard'
import {
  LISTING_PAGE_SIZE, getCityBySlug, getCityDirectory, getCityPlaces, getPopularPlaces,
  type ListingCategory, type ListingCity,
} from '@/features/places/listings'
import { cityCategoryPath, cityPath, isSlug, listingHeadline, placePath } from '@/features/places/seo-routes'

// Listado SEO de una ciudad (y, opcionalmente, una categoría). Lo comparten las tres rutas
// de /c: /c/[ciudad], /c/[ciudad]/[categoria|página] y /c/[ciudad]/[categoria]/[página].

export type ListingTarget = { city: ListingCity; category: ListingCategory | null; basePath: string }

/** Resuelve ciudad y categoría desde los slugs de la URL; 404 si alguno no existe o está vacío. */
export async function resolveListing(citySlug: string, categorySlug: string | null): Promise<ListingTarget> {
  if (!isSlug(citySlug) || (categorySlug !== null && !isSlug(categorySlug))) notFound()
  const city = await getCityBySlug(citySlug)
  if (!city) notFound()
  if (categorySlug === null) return { city, category: null, basePath: cityPath(city.slug) }
  const category = city.categories.find((c) => c.slug === categorySlug)
  if (!category) notFound()
  return { city, category, basePath: cityCategoryPath(city.slug, category.slug) }
}

const totalOf = ({ city, category }: ListingTarget) => category?.places ?? city.places

export function listingMetadata(target: ListingTarget, page: number): Metadata {
  const { city, category, basePath } = target
  const total = totalOf(target)
  if (page > pageCount(total, LISTING_PAGE_SIZE)) notFound()
  const headline = listingHeadline(city.name, category)
  const title = `${headline}${page > 1 ? ` — página ${page}` : ''} | Goospe`
  const what = category ? `${category.name.toLowerCase()} en ${city.name}` : `lugares en ${city.name}`
  const description = `${total.toLocaleString('es-CL')} ${total === 1 ? 'opción' : 'opciones'} de ${what}, ${city.country}: fotos, horarios, cómo llegar y reseñas. Decide a dónde ir hoy con Goospe.`
  const canonical = pageHref(basePath, page)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: 'Goospe', type: 'website' },
  }
}


export async function CityListing({ target, page }: { target: ListingTarget; page: number }) {
  const { city, category, basePath } = target
  const pages = pageCount(totalOf(target), LISTING_PAGE_SIZE)
  if (page > pages) notFound()

  const [{ places, total }, popular, directory] = await Promise.all([
    getCityPlaces(city.id, category?.id ?? null, page),
    page === 1 ? getPopularPlaces(city.id, category?.id ?? null) : Promise.resolve([]),
    getCityDirectory(),
  ])
  if (places.length === 0) notFound()

  const headline = listingHeadline(city.name, category)
  const crumbs: Crumb[] = [
    { label: 'Lugares', href: '/places' },
    category ? { label: city.name, href: cityPath(city.slug) } : { label: city.name },
    ...(category ? [{ label: category.name }] : []),
  ]
  const offset = pageOffset(page, LISTING_PAGE_SIZE)
  const others = directory.filter((c) => c.country === city.country && c.id !== city.id)
    .sort((a, b) => b.places - a.places).slice(0, 12)

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={pageShell}>
        <Breadcrumbs items={crumbs} className="mb-4" />
        <h1 className={pageTitle}>
          {headline.endsWith(city.name)
            ? <>{headline.slice(0, -city.name.length)}<span className="font-medium">{city.name}</span></>
            : headline}
        </h1>
        <p className="mt-3 text-fg-soft">
          {total.toLocaleString('es-CL')} {total === 1 ? 'lugar' : 'lugares'} en {city.name}, {city.country}
          {pages > 1 && ` · página ${page} de ${pages}`}
        </p>

        {/* categorías de la ciudad (enlaces internos a cada listado) */}
        <nav aria-label="Categorías" className="mt-5 flex flex-wrap gap-2">
          <Link href={cityPath(city.slug)} className={pill(!category)} aria-current={category ? undefined : 'page'}>
            Todo <span className="text-xs opacity-70">{city.places.toLocaleString('es-CL')}</span>
          </Link>
          {city.categories.map((c) => {
            const Icon = categoryIcon(c.emoji)
            const active = category?.id === c.id
            return (
              <Link key={c.id} href={cityCategoryPath(city.slug, c.slug)} className={pill(active)} aria-current={active ? 'page' : undefined}>
                <Icon size={15} strokeWidth={1.75} /> {c.name} <span className="text-xs opacity-70">{c.places.toLocaleString('es-CL')}</span>
              </Link>
            )
          })}
        </nav>

        {popular.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-medium text-fg">
              <TrendingUp size={18} strokeWidth={1.75} className="text-ink" /> Populares en {city.name}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((p) => <PlaceCard key={p.id} place={p} />)}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-fg">
            {category ? `${category.name} en ${city.name}` : `Todos los lugares de ${city.name}`}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {places.map((p) => <PlaceCard key={p.id} place={p} />)}
          </div>
          <Pagination basePath={basePath} page={page} pages={pages} />
        </section>

        {others.length > 0 && (
          <section className="mt-12 border-t border-line pt-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">Otras ciudades en {city.country}</h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {others.map((c) => (
                <li key={c.id}>
                  <Link href={category && c.categories.some((x) => x.slug === category.slug) ? cityCategoryPath(c.slug, category.slug) : cityPath(c.slug)}
                    className="text-fg-soft transition hover:text-ink">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: headline,
          numberOfItems: total,
          itemListElement: places.map((p, i) => ({
            '@type': 'ListItem',
            position: offset + i + 1,
            name: p.name,
            url: absoluteUrl(placePath(p.slug)),
          })),
        }}
      />
      <AppFooter />
    </main>
  )
}
