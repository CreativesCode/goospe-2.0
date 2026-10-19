import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { absoluteUrl } from '@/lib/email/config'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { JsonLd } from '@/shared/components/json-ld'
import { PageHeader } from '@/shared/components/page-header'
import { eyebrow, pageShell } from '@/shared/lib/ui'
import { categoryIcon } from '@/shared/lib/icons'
import { getCityDirectory, groupByCountry } from '@/features/places/listings'
import { cityCategoryPath, cityPath } from '@/features/places/seo-routes'

// Índice de ciudades. Antes esta página pintaba el catálogo entero en cards (miles de lugares,
// megas de HTML); ahora enlaza a los listados paginados de cada ciudad y categoría (/c/…).
// `?page=` de la versión anterior se ignora: la canónica es /places.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Lugares por ciudad | Goospe',
  description: 'Explora Goospe por ciudad: dónde comer, tomar café y salir de noche en cada lugar donde estamos.',
  alternates: { canonical: '/places' },
}

export default async function PlacesIndexPage() {
  const cities = await getCityDirectory()
  const groups = groupByCountry(cities)
  const total = cities.reduce((sum, c) => sum + c.places, 0)

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={pageShell}>
        <PageHeader
          kicker="Explora"
          title={<>Lugares por <span className="font-medium">ciudad</span></>}
          subtitle={`${total.toLocaleString('es-CL')} lugares en ${cities.length} ${cities.length === 1 ? 'ciudad' : 'ciudades'}. Elige la tuya.`}
        />

        {groups.map((g) => (
          <section key={g.country} className="mt-8 first-of-type:mt-0">
            <h2 className={`${eyebrow} mb-3`}>{g.country}</h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.cities.map((city) => (
                <li key={city.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                  <Link href={cityPath(city.slug)} className="group flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium text-fg transition group-hover:text-ink">
                        <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-ink" /> {city.name}
                      </span>
                      {city.region && <span className="block text-xs text-muted">{city.region}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-fg-soft">{city.places.toLocaleString('es-CL')} lugares</span>
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {city.categories.map((c) => {
                      const Icon = categoryIcon(c.emoji)
                      return (
                        <Link key={c.id} href={cityCategoryPath(city.slug, c.slug)}
                          className="inline-flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-xs text-ink transition hover:bg-tint2">
                          <Icon size={12} strokeWidth={1.75} /> {c.name} · {c.places.toLocaleString('es-CL')}
                        </Link>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Ciudades en Goospe',
          numberOfItems: cities.length,
          itemListElement: cities.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            url: absoluteUrl(cityPath(c.slug)),
          })),
        }}
      />
      <AppFooter />
    </main>
  )
}
