import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SavedRow = {
  place_id: string
  places: {
    id: string
    slug: string
    name: string
    vibe_line: string | null
    description: string | null
    price_level: number | null
    place_photos: { url: string; status: string | null }[]
    place_categories: { categories: { emoji: string | null; name: string } | null }[]
  } | null
}

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/saved')

  const { data, error } = await supabase
    .from('favorites')
    .select(
      'place_id, places(id, slug, name, vibe_line, description, price_level, place_photos(url, status), place_categories(categories(emoji, name)))'
    )
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as SavedRow[]
  const places = rows.map((r) => r.places).filter(Boolean) as NonNullable<SavedRow['places']>[]

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="mb-6 inline-flex items-center gap-2 text-2xl font-medium text-fg">
          <Heart size={22} strokeWidth={1.75} className="text-goospe-green" /> Mis guardados
          <span className="text-base font-normal text-muted">· {places.length}</span>
        </h1>

        {error && <p className="text-red-600">Error: {error.message}</p>}

        {!error && places.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
              <Heart size={30} strokeWidth={1.5} />
            </span>
            <p className="text-lg font-medium text-fg">Aún no guardas nada</p>
            <p className="max-w-sm text-sm text-fg-soft">
              Toca el corazón en cualquier lugar del feed y aparecerá aquí.
            </p>
            <Link
              href="/feed"
              className="mt-2 rounded-full bg-goospe-gradient px-6 py-2.5 text-sm font-medium text-white shadow"
            >
              Explorar lugares
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((p) => {
            const photo = p.place_photos?.find((ph) => ph.status === 'approved')?.url
            const Cat = categoryIcon(p.place_categories?.[0]?.categories?.emoji)
            return (
              <Link
                href={`/places/${p.slug}`}
                key={p.id}
                className="group block overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-goospe-gradient text-white">
                      <Cat size={44} strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-4">
                  <h2 className="font-medium leading-tight text-fg">{p.name}</h2>
                  {p.vibe_line && <p className="text-sm font-medium text-goospe-green">{p.vibe_line}</p>}
                  {p.description && (
                    <p className="line-clamp-2 text-sm leading-snug text-fg-soft">{p.description}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
