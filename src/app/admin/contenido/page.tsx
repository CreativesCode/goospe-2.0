import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { ModStatusButtons } from '@/features/admin/ModStatusButtons'

export const dynamic = 'force-dynamic'

const fmt = (s: string) => new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const badge = (status: string) => {
  const hidden = status === 'blocked' || status === 'rejected'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${hidden ? 'bg-red-100 text-red-600' : 'bg-goospe-green/10 text-goospe-green-dark'}`}>
      {hidden ? 'Oculto' : 'Visible'}
    </span>
  )
}

export default async function AdminContenidoPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/contenido')
  if (!(await isAdmin(user.id))) redirect('/feed')

  const admin = createAdminClient()
  const [{ data: reviews }, { data: events }] = await Promise.all([
    admin.from('reviews').select('id, rating, body, status, created_at, places(name, slug)').order('created_at', { ascending: false }).limit(40),
    admin.from('events').select('id, name, status, starts_at, places(name, slug)').order('created_at', { ascending: false }).limit(40),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rv = (reviews ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = (events ?? []) as any[]

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/feed"><img src="/brand/logo-color.svg" alt="Goospe" className="h-7" /></Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin/fotos" className="text-goospe-gray/60 hover:text-goospe-green">Fotos</Link>
            <span className="rounded-full bg-goospe-green/10 px-3 py-1 text-xs font-medium text-goospe-green-dark">Contenido</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-8">
        <section>
          <h1 className="mb-4 text-xl font-medium text-goospe-gray">Reseñas recientes</h1>
          {rv.length === 0 ? <p className="text-sm text-goospe-gray/50">Sin reseñas.</p> : (
            <ul className="space-y-2">
              {rv.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 rounded-xl border border-black/5 bg-white p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-goospe-green">{'★'.repeat(r.rating)}</span>
                      {r.places && <Link href={`/places/${r.places.slug}`} className="text-sm font-medium text-goospe-gray hover:text-goospe-green">{r.places.name}</Link>}
                      {badge(r.status)}
                      <span className="text-xs text-goospe-gray/40">{fmt(r.created_at)}</span>
                    </div>
                    {r.body && <p className="mt-1 text-sm text-goospe-gray/70">{r.body}</p>}
                  </div>
                  <ModStatusButtons type="review" id={r.id} status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h1 className="mb-4 text-xl font-medium text-goospe-gray">Eventos recientes</h1>
          {ev.length === 0 ? <p className="text-sm text-goospe-gray/50">Sin eventos.</p> : (
            <ul className="space-y-2">
              {ev.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-white p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-goospe-gray">{e.name}</span>
                      {badge(e.status)}
                    </div>
                    <p className="text-xs text-goospe-gray/50">
                      {e.places?.name} · {fmt(e.starts_at)}
                    </p>
                  </div>
                  <ModStatusButtons type="event" id={e.id} status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
