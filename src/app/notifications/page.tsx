import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PageHeader } from '@/shared/components/page-header'
import { pageShell } from '@/shared/lib/ui'
import { NotificationHistory } from '@/features/notifications/NotificationHistory'
import type { Notif } from '@/features/notifications/Notifications'
import { pageRange, totalPages } from '@/features/notifications/kinds'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notificaciones | Goospe', robots: { index: false } }

const pagerOn = 'rounded-full border border-line bg-card px-4 py-2 font-medium text-fg-soft transition hover:text-fg'
const pagerOff = 'rounded-full border border-line px-4 py-2 text-muted opacity-50'
const href = (page: number) => (page <= 1 ? '/notifications' : `/notifications?page=${page}`)
const isRangeError = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST103' || /range not satisfiable/i.test(e.message ?? '')

// Historial completo de notificaciones, paginado. Lee con el cliente del usuario: la RLS
// "own notifications read" solo devuelve las suyas.
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/notifications')

  const { page, from, to } = pageRange((await searchParams).page)
  const [list, unread] = await Promise.all([
    sb.from('notifications').select('id, kind, title, body, link, read, created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to),
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
  ])
  // Página más allá de la última: PostgREST no devuelve "0 filas" sino el error PGRST103
  // ("Requested range not satisfiable"), así que el redirect de abajo nunca llegaba a ejecutarse.
  // Se cuenta aparte y se manda a la última página real.
  if (list.error && page > 1 && isRangeError(list.error)) {
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true })
    redirect(href(Math.min(totalPages(count), page - 1)))
  }
  if (list.error) throw new Error(list.error.message) // lo captura src/app/error.tsx
  const pages = totalPages(list.count)
  if (page > pages) redirect(href(pages))
  type DbRow = Omit<Notif, 'read' | 'created_at'> & { read: boolean | null; created_at: string | null }
  const rows: Notif[] = ((list.data ?? []) as unknown as DbRow[]).map((n) => ({ ...n, read: !!n.read, created_at: n.created_at ?? '' }))

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={pageShell}>
        <div className="max-w-3xl">
        <PageHeader
          title={<span className="font-medium">Notificaciones</span>}
          actions={
            <Link href="/profile/account#avisos" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg">
              <Settings size={16} strokeWidth={1.75} /> Preferencias
            </Link>
          }
        />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-12 text-center">
            <p className="font-medium text-fg">Aún no tienes notificaciones</p>
            <p className="mt-1 text-sm text-fg-soft">Aquí verás las novedades de los lugares que guardas, tus eventos y tus reseñas.</p>
          </div>
        ) : (
          // key por página: al navegar se monta con las filas nuevas.
          <NotificationHistory key={page} initial={rows} unreadTotal={unread.count ?? 0} />
        )}

        {pages > 1 && (
          <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? <Link href={href(page - 1)} rel="prev" className={pagerOn}>Más recientes</Link> : <span className={pagerOff}>Más recientes</span>}
            <span className="text-muted">Página {page} de {pages}</span>
            {page < pages ? <Link href={href(page + 1)} rel="next" className={pagerOn}>Anteriores</Link> : <span className={pagerOff}>Anteriores</span>}
          </nav>
        )}
        </div>
      </div>
      <AppFooter />
    </main>
  )
}
