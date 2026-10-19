import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ModerationActions } from '@/features/photos/ModerationActions'
import { PhotoImg } from '@/shared/components/photo-img'
import { requireAdmin } from '@/lib/admin-guard'
import { adminChip, adminTitle } from '@/features/admin/ui'

export const metadata: Metadata = { title: 'Moderar fotos' }

export const dynamic = 'force-dynamic'

const PAGE = 48
// Filtro por fuente. 'user' = fotos subidas por usuarios (las que más urge revisar).
const SOURCES = [
  { key: 'all', label: 'Todas' },
  { key: 'user', label: 'De usuarios' },
  { key: 'mapillary', label: 'Mapillary' },
  { key: 'google', label: 'Google' },
] as const
type SourceKey = (typeof SOURCES)[number]['key']

type Pending = {
  id: string
  url: string
  source: string | null
  created_at: string | null
  places: { slug: string; name: string } | null
}

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

export default async function AdminFotosPage({ searchParams }: { searchParams: Promise<{ fuente?: string; page?: string }> }) {
  await requireAdmin('/admin/photos') // guard propio: el del layout no evita que la página consulte
  const sp = await searchParams
  const fuente: SourceKey = SOURCES.some((s) => s.key === sp.fuente) ? (sp.fuente as SourceKey) : 'all'
  const reqPage = Math.max(1, Math.floor(Number(sp.page)) || 1)
  const from = (reqPage - 1) * PAGE
  const admin = createAdminClient()

  const href = (patch: { fuente?: SourceKey; page?: number }) => {
    const f = patch.fuente ?? fuente
    const p = patch.page ?? 1
    const qs = new URLSearchParams()
    if (f !== 'all') qs.set('fuente', f)
    if (p > 1) qs.set('page', String(p))
    const s = qs.toString()
    return `/admin/photos${s ? `?${s}` : ''}`
  }

  // Conteo real por fuente (head: no descarga filas) + la página pedida.
  const countFor = (key: SourceKey) => {
    let q = admin.from('place_photos').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    if (key !== 'all') q = q.eq('source', key)
    return q
  }
  let listQuery = admin
    .from('place_photos')
    .select('id, url, source, created_at, places(slug, name)', { count: 'exact' })
    .eq('status', 'pending')
    // Prioridad: primero las de usuarios ('user' > 'mapillary' > 'google' en orden descendente)
    // y, dentro de cada fuente, las más recientes. Antes salían las 100 más antiguas (todas
    // Mapillary) y las fotos nuevas de usuarios nunca llegaban a la cola.
    .order('source', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + PAGE - 1)
  if (fuente !== 'all') listQuery = listQuery.eq('source', fuente)

  const [listRes, countRes] = await Promise.all([listQuery, Promise.all(SOURCES.map((s) => countFor(s.key)))])
  const pending = (listRes.data ?? []) as unknown as Pending[]
  // Página fuera de rango (p. ej. tras moderar la última de la página) → a la primera.
  if (reqPage > 1 && pending.length === 0) redirect(href({ page: 1 }))

  const counts = Object.fromEntries(SOURCES.map((s, i) => [s.key, countRes[i]?.count ?? 0])) as Record<SourceKey, number>
  const total = listRes.count ?? counts[fuente]
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div>
      <h1 className={`${adminTitle} mb-4`}>Fotos por <span className="font-medium">revisar</span> <span className="text-muted">{counts.all.toLocaleString('es-CL')}</span></h1>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {SOURCES.map((s) => (
          <Link
            key={s.key}
            href={href({ fuente: s.key })}
            className={adminChip(fuente === s.key)}
          >
            {s.label} · {counts[s.key].toLocaleString('es-CL')}
          </Link>
        ))}
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tint text-ink">
            <CheckCircle2 size={28} strokeWidth={1.5} />
          </span>
          <p className="text-fg-soft">
            {fuente === 'all' ? 'No hay fotos pendientes. Todo al día.' : 'No hay fotos pendientes de esta fuente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((ph) => (
            <div key={ph.id} className="overflow-hidden rounded-[22px] border border-line bg-card">
              <PhotoImg src={ph.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  {ph.places ? (
                    <Link href={`/places/${ph.places.slug}`} className="min-w-0 truncate font-medium text-fg hover:text-ink">
                      {ph.places.name}
                    </Link>
                  ) : <span className="text-muted">—</span>}
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${ph.source === 'user' ? 'bg-tint font-medium text-ink' : 'bg-surface text-muted'}`}>
                    {ph.source === 'user' ? 'usuario' : ph.source ?? '?'}
                  </span>
                </div>
                {ph.created_at && <p className="text-xs text-muted">Subida el {fmt(ph.created_at)}</p>}
                <ModerationActions photoId={ph.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Página {reqPage} de {pages} · {total.toLocaleString('es-CL')} fotos</span>
          <div className="flex items-center gap-2">
            {reqPage > 1
              ? <Link href={href({ page: reqPage - 1 })} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-fg-soft transition hover:text-fg">Anterior</Link>
              : <span className="rounded-full border border-line px-3 py-1 text-muted opacity-50">Anterior</span>}
            {reqPage < pages
              ? <Link href={href({ page: reqPage + 1 })} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-fg-soft transition hover:text-fg">Siguiente</Link>
              : <span className="rounded-full border border-line px-3 py-1 text-muted opacity-50">Siguiente</span>}
          </div>
        </div>
      )}
    </div>
  )
}
