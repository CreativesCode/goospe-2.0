import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { appContainer, pageTitle } from '@/shared/lib/ui'
import { createClient } from '@/lib/supabase/server'
import { FavoritesMigrator } from '@/features/places/FavoritesMigrator'
import { SavedGrid } from '@/features/places/SavedGrid'
import { SAVED_PLACE_SELECT, savedToCard, type SavedRow } from '@/features/places/saved-places'

export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/saved')

  const { data, error } = await supabase
    .from('favorites')
    .select(SAVED_PLACE_SELECT)
    .order('created_at', { ascending: false })

  // Lanza para que lo capture src/app/error.tsx (antes mostraba un crudo "Error: …" + "· 0").
  if (error) throw new Error(error.message)
  const places = savedToCard((data ?? []) as unknown as SavedRow[])

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      {/* Sube los guardados hechos sin sesión y refresca (el login puede aterrizar aquí). */}
      <FavoritesMigrator />

      <div className={`${appContainer} pb-14 pt-[18px] md:pt-7`}>
        <h1 className={pageTitle}>
          Guardados <span className="text-[0.5em] font-normal tracking-normal text-muted">{places.length}</span>
        </h1>

        {places.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint text-goospe-green">
              <Heart size={30} strokeWidth={1.5} />
            </span>
            <p className="text-lg font-medium text-fg">Aún no guardas nada</p>
            <p className="max-w-sm text-sm text-fg-soft">
              Toca el corazón en cualquier lugar del feed y aparecerá aquí.
            </p>
            <Link href="/feed" className="mt-2 inline-flex h-12 items-center rounded-full bg-goospe-green px-6 text-sm font-medium text-on-brand transition hover:brightness-105">
              Explorar lugares
            </Link>
          </div>
        ) : (
          <SavedGrid places={places} />
        )}
      </div>

      <AppFooter />
    </main>
  )
}
