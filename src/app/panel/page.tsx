import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ArrowRight, Store } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type OwnedPlace = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  is_published: boolean
  place_photos: { url: string; status: string | null }[]
}

export default async function PanelPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel')

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
  const businessIds = ((memberships ?? []) as { business_id: string }[]).map((m) => m.business_id)

  let places: OwnedPlace[] = []
  if (businessIds.length) {
    const { data } = await admin
      .from('places')
      .select('id, slug, name, vibe_line, is_published, place_photos(url, status)')
      .in('business_id', businessIds)
      .order('name')
    places = (data ?? []) as unknown as OwnedPlace[]
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-medium text-fg">Mis lugares</h1>
          <Link
            href="/panel/claim"
            className="inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow"
          >
            <Plus size={16} strokeWidth={2} /> Reclamar un lugar
          </Link>
        </div>

        {places.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-card py-20 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
              <Store size={30} strokeWidth={1.5} />
            </span>
            <p className="text-lg font-medium text-fg">Aún no administras ningún lugar</p>
            <p className="max-w-sm text-sm text-fg-soft">
              Reclama tu negocio en Puerto Varas para editar su ficha, fotos y datos de contacto.
            </p>
            <Link
              href="/panel/claim"
              className="mt-2 rounded-full bg-goospe-gradient px-6 py-2.5 text-sm font-medium text-white shadow"
            >
              Reclamar mi negocio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((p) => {
              const photo = p.place_photos?.find((ph) => ph.status === 'approved')?.url
              return (
                <Link
                  key={p.id}
                  href={`/panel/${p.id}`}
                  className="group overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-goospe-gradient">
                        <img src="/brand/isotipo-white.svg" alt="" className="h-10 w-10 opacity-90" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-medium text-fg">{p.name}</h2>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.is_published ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-line text-muted'}`}>
                        {p.is_published ? 'Publicado' : 'Oculto'}
                      </span>
                    </div>
                    {p.vibe_line && <p className="text-sm text-goospe-green">{p.vibe_line}</p>}
                    <p className="inline-flex items-center gap-1 pt-1 text-xs text-muted group-hover:text-goospe-green">Editar ficha <ArrowRight size={12} strokeWidth={1.75} /></p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
