import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { ModerationActions } from '@/features/photos/ModerationActions'

export const dynamic = 'force-dynamic'

export default async function AdminFotosPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/fotos')
  if (!(await isAdmin(user.id))) redirect('/feed')

  const admin = createAdminClient()
  const { data } = await admin
    .from('place_photos')
    .select('id, url, source, created_at, places(slug, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (data ?? []) as any[]

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/feed"><img src="/brand/logo-color.svg" alt="Goospe" className="h-7" /></Link>
          <span className="rounded-full bg-goospe-green/10 px-3 py-1 text-xs font-medium text-goospe-green-dark">
            Moderación · {pending.length} pendientes
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-medium text-goospe-gray">Fotos por revisar</h1>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white py-20 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-80" />
            <p className="text-goospe-gray/60">No hay fotos pendientes. Todo al día ✨</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((ph) => (
              <div key={ph.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-sm">
                    {ph.places ? (
                      <Link href={`/places/${ph.places.slug}`} className="font-medium text-goospe-gray hover:text-goospe-green">
                        {ph.places.name}
                      </Link>
                    ) : <span className="text-goospe-gray/50">—</span>}
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-goospe-gray/50">{ph.source ?? '?'}</span>
                  </div>
                  <ModerationActions photoId={ph.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
