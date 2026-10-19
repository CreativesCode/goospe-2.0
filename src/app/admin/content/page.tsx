import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ModStatusButtons } from '@/features/admin/ModStatusButtons'
import { requireAdmin } from '@/lib/admin-guard'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'
import { adminTitle } from '@/features/admin/ui'
import { AdminEventRow, type AdminEvent } from '@/features/admin/AdminEventRow'

export const metadata: Metadata = { title: 'Moderar contenido' }

export const dynamic = 'force-dynamic'

const fmt = (s: string) => fmtInZone(s, ADMIN_TZ, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const badge = (status: string) => {
  const hidden = status === 'blocked' || status === 'rejected'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${hidden ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-tint text-ink'}`}>
      {hidden ? 'Oculto' : 'Visible'}
    </span>
  )
}

export default async function AdminContenidoPage() {
  await requireAdmin('/admin/content') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()
  const [{ data: reviews }, { data: events }] = await Promise.all([
    admin.from('reviews').select('id, rating, body, status, created_at, places(name, slug)').order('created_at', { ascending: false }).limit(40),
    admin.from('events').select('id, name, description, image_url, status, starts_at, ends_at, created_at, is_boosted, places(name, slug, cities(name, timezone))').order('created_at', { ascending: false }).limit(40),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rv = (reviews ?? []) as any[]
  const ev = (events ?? []) as unknown as AdminEvent[]

  return (
    <div className="space-y-10">
      <h1 className={`${adminTitle}`}>Moderación de <span className="font-medium">contenido</span></h1>

      <section>
          <h2 className="mb-4 text-xl font-medium text-fg">Reseñas recientes</h2>
          {rv.length === 0 ? <p className="text-sm text-muted">Sin reseñas.</p> : (
            <ul className="space-y-2">
              {rv.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 rounded-[22px] border border-line bg-card p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm text-ink">
                        <Star size={13} strokeWidth={1.75} fill="currentColor" /> {r.rating}
                      </span>
                      {r.places && <Link href={`/places/${r.places.slug}`} className="text-sm font-medium text-fg hover:text-ink">{r.places.name}</Link>}
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
          <h2 className="mb-1 text-xl font-medium text-fg">Eventos recientes</h2>
          <p className="mb-4 text-sm text-fg-soft">Pulsa un evento para ver su imagen, descripción y horario antes de decidir.</p>
          {ev.length === 0 ? <p className="text-sm text-muted">Sin eventos.</p> : (
            <ul className="space-y-2">
              {ev.map((e) => <AdminEventRow key={e.id} ev={e} />)}
            </ul>
          )}
        </section>
    </div>
  )
}
