import Link from 'next/link'
import { redirect } from 'next/navigation'
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
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/feed"><img src="/brand/logo-color.svg" alt="Goospe" className="h-7" /></Link>
          <span className="rounded-full bg-goospe-green/10 px-3 py-1 text-xs font-medium text-goospe-green-dark">
            Panel de negocio
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-medium text-goospe-gray">Mis lugares</h1>
          <Link
            href="/panel/reclamar"
            className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow"
          >
            + Reclamar un lugar
          </Link>
        </div>

        {places.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-16 w-16 opacity-80" />
            <p className="text-lg font-medium text-goospe-gray">Aún no administras ningún lugar</p>
            <p className="max-w-sm text-sm text-goospe-gray/60">
              Reclama tu negocio en Puerto Varas para editar su ficha, fotos y datos de contacto.
            </p>
            <Link
              href="/panel/reclamar"
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
                  className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md"
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
                      <h2 className="font-medium text-goospe-gray">{p.name}</h2>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.is_published ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_published ? 'Publicado' : 'Oculto'}
                      </span>
                    </div>
                    {p.vibe_line && <p className="text-sm text-goospe-green">{p.vibe_line}</p>}
                    <p className="pt-1 text-xs text-goospe-gray/50 group-hover:text-goospe-green">Editar ficha →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
