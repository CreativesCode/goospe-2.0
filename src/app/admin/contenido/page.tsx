import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
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
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium text-fg">Moderación</h1>
          <nav className="flex items-center gap-1 rounded-full border border-line bg-card p-1 text-sm">
            <Link href="/admin/fotos" className="rounded-full px-3 py-1 text-fg-soft hover:text-fg">Fotos</Link>
            <span className="rounded-full bg-goospe-green/10 px-3 py-1 font-medium text-goospe-green-dark">Contenido</span>
          </nav>
        </div>

        <section>
          <h1 className="mb-4 text-xl font-medium text-fg">Reseñas recientes</h1>
          {rv.length === 0 ? <p className="text-sm text-muted">Sin reseñas.</p> : (
            <ul className="space-y-2">
              {rv.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm text-goospe-green">
                        <Star size={13} strokeWidth={1.75} fill="currentColor" /> {r.rating}
                      </span>
                      {r.places && <Link href={`/places/${r.places.slug}`} className="text-sm font-medium text-fg hover:text-goospe-green">{r.places.name}</Link>}
                      {badge(r.status)}
                      <span className="text-xs text-muted">{fmt(r.created_at)}</span>
                    </div>
                    {r.body && <p className="mt-1 text-sm text-fg-soft">{r.body}</p>}
                  </div>
                  <ModStatusButtons type="review" id={r.id} status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h1 className="mb-4 text-xl font-medium text-fg">Eventos recientes</h1>
          {ev.length === 0 ? <p className="text-sm text-muted">Sin eventos.</p> : (
            <ul className="space-y-2">
              {ev.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-fg">{e.name}</span>
                      {badge(e.status)}
                    </div>
                    <p className="text-xs text-muted">
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

      <AppFooter />
    </main>
  )
}
