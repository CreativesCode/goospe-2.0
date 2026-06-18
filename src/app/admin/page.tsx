import Link from 'next/link'
import {
  Store, Eye, Users, Heart, Compass, Share2, Sparkles, Image, MessageSquare, Calendar,
  Activity, ImageIcon, BadgeCheck, type LucideIcon,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DAY = 86400_000
const fmtUsd = (n: number) => `$${n.toFixed(2)}`
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export default async function AdminDashboard() {
  const admin = createAdminClient()
  // RPCs nuevas (0023) aún no están en database.types.ts → helper sin tipado estricto.
  const arpc = admin.rpc.bind(admin) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
  const since7 = new Date(Date.now() - 7 * DAY).toISOString()

  const [
    places, published, claimed,
    users, usersNew,
    reviewsPending, eventsPending, photosPending,
    interTotal, kindCounts, aiSummary, withPhotoRes, topRes, dailyRes,
  ] = await Promise.all([
    admin.from('places').select('*', { count: 'exact', head: true }),
    admin.from('places').select('*', { count: 'exact', head: true }).eq('is_published', true),
    admin.from('places').select('*', { count: 'exact', head: true }).not('business_id', 'is', null),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since7),
    admin.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'blocked'),
    admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('place_photos').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('interactions').select('*', { count: 'exact', head: true }),
    arpc('admin_interaction_counts'),
    arpc('admin_ai_usage_summary'),
    arpc('admin_places_with_photo'),
    arpc('admin_top_places', { p_limit: 5, p_value_only: false }),
    arpc('admin_interaction_daily', { p_days: 14 }),
  ])

  // interacciones por tipo (agregado en SQL, no se descarga la tabla)
  const kindRows = (kindCounts.data ?? []) as { kind: string; total: number }[]
  const byKind = Object.fromEntries(kindRows.map((r) => [r.kind, Number(r.total)])) as Record<string, number>
  const totalInteractions = interTotal.count ?? 0

  // top 5 lugares (agregado + join en SQL)
  const top = ((topRes.data ?? []) as { id: string; name: string; slug: string; n: number }[])
    .map((r) => ({ place: { id: r.id, name: r.name, slug: r.slug }, n: Number(r.n) }))

  // con foto (distinct, en SQL)
  const withPhoto = Number(withPhotoRes.data ?? 0)

  // gasto IA (sumado en SQL: total / 30d / 7d)
  const aiRows = (aiSummary.data ?? []) as { scope: string; usd: string | number; tokens: number; calls: number }[]
  const aiBy = (scope: string) => {
    const r = aiRows.find((x) => x.scope === scope)
    return { usd: Number(r?.usd ?? 0), tok: Number(r?.tokens ?? 0), n: Number(r?.calls ?? 0) }
  }
  const aiTotal = aiBy('total'); const ai30 = aiBy('d30'); const ai7 = aiBy('d7')

  // actividad diaria (agregado en SQL, días sin datos vienen en 0)
  const activity = ((dailyRes.data ?? []) as { day: string; n: number }[]).map((r) => ({ d: r.day, n: Number(r.n) }))
  const maxActivity = Math.max(1, ...activity.map((a) => a.n))

  // embudo de descubrimiento
  const fViews = byKind['view_card'] ?? 0
  const fDetails = byKind['view_detail'] ?? 0
  const fActions = (byKind['save'] ?? 0) + (byKind['directions'] ?? 0) + (byKind['share'] ?? 0)
  const funnel = [
    { label: 'Apariciones en feed', n: fViews, pct: 100 },
    { label: 'Vistas de ficha', n: fDetails, pct: fViews ? (fDetails / fViews) * 100 : 0 },
    { label: 'Acciones (guardar · cómo llego · compartir)', n: fActions, pct: fViews ? (fActions / fViews) * 100 : 0 },
  ]

  // cobertura del catálogo
  const totalPlaces = places.count ?? 0
  const coverage = [
    { label: 'Publicados', n: published.count ?? 0, icon: Eye },
    { label: 'Con foto', n: withPhoto, icon: ImageIcon },
    { label: 'Reclamados', n: claimed.count ?? 0, icon: BadgeCheck },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Dashboard</h1>
        <p className="text-sm text-fg-soft">Visión general del piloto Goospe · Puerto Varas.</p>
      </header>

      {/* KPIs principales */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi icon={Store} label="Lugares" value={places.count ?? 0} hint={`${published.count ?? 0} publicados · ${withPhoto} con foto`} />
        <Kpi icon={Users} label="Usuarios" value={users.count ?? 0} hint={`+${usersNew.count ?? 0} en 7 días`} />
        <Kpi icon={Sparkles} label="Gasto IA" value={fmtUsd(aiTotal.usd)} hint={`${fmtTok(aiTotal.tok)} tokens · ${aiTotal.n} llamadas`} accent />
        <Kpi icon={Eye} label="Interacciones" value={totalInteractions} hint="todas las acciones" />
      </section>

      {/* moderación pendiente */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pending href="/admin/photos" icon={Image} label="Fotos por revisar" n={photosPending.count ?? 0} />
        <Pending href="/admin/content" icon={MessageSquare} label="Reseñas ocultas" n={reviewsPending.count ?? 0} />
        <Pending href="/admin/content" icon={Calendar} label="Eventos pendientes" n={eventsPending.count ?? 0} />
      </section>

      {/* actividad diaria */}
      <Card title="Actividad · últimos 14 días">
        <div className="flex items-end gap-1.5" style={{ height: 110 }}>
          {activity.map(({ d, n }) => (
            <div key={d} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}: ${n} interacciones`}>
              <span className="text-[9px] font-medium text-muted opacity-0 transition group-hover:opacity-100">{n}</span>
              <div className="w-full rounded-t bg-goospe-green/70 transition group-hover:bg-goospe-green" style={{ height: `${Math.max(3, (n / maxActivity) * 100)}%` }} />
              <span className="text-[9px] text-muted">{d.slice(8, 10)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Activity size={12} /> interacciones por día</div>
      </Card>

      {/* embudo + cobertura */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Embudo de descubrimiento">
          <ul className="space-y-3">
            {funnel.map((f, i) => (
              <li key={f.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-fg">{f.label}</span>
                  <span className="font-medium text-fg">{f.n}{i > 0 && <span className="ml-1 text-muted">· {f.pct.toFixed(0)}%</span>}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-goospe-green/70" style={{ width: `${Math.min(100, f.pct)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <Link href="/admin/stats" className="mt-3 inline-block text-sm font-medium text-goospe-green hover:underline">Ver estadísticas →</Link>
        </Card>

        <Card title="Cobertura del catálogo">
          <ul className="space-y-3">
            {coverage.map(({ label, n, icon: Icon }) => {
              const pct = totalPlaces ? (n / totalPlaces) * 100 : 0
              return (
                <li key={label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 text-fg"><Icon size={15} strokeWidth={1.75} className="text-goospe-green" /> {label}</span>
                    <span className="font-medium text-fg">{n} <span className="text-muted">· {pct.toFixed(0)}%</span></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-goospe-green/70" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <Link href="/admin/places" className="mt-3 inline-block text-sm font-medium text-goospe-green hover:underline">Gestionar lugares →</Link>
        </Card>
      </section>

      {/* gasto IA + interacciones por tipo */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Gasto de IA">
          <Row label="Total" a={fmtUsd(aiTotal.usd)} b={`${fmtTok(aiTotal.tok)} tok`} />
          <Row label="Últimos 30 días" a={fmtUsd(ai30.usd)} b={`${fmtTok(ai30.tok)} tok`} />
          <Row label="Últimos 7 días" a={fmtUsd(ai7.usd)} b={`${fmtTok(ai7.tok)} tok`} />
          <Link href="/admin/ai-costs" className="mt-3 inline-block text-sm font-medium text-goospe-green hover:underline">Ver detalle de gastos →</Link>
        </Card>

        <Card title="Interacciones por tipo">
          {INTERACTION_LABELS.map(({ kind, label, icon: Icon }) => (
            <div key={kind} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="inline-flex items-center gap-2 text-fg-soft"><Icon size={15} strokeWidth={1.75} /> {label}</span>
              <span className="font-medium text-fg">{byKind[kind] ?? 0}</span>
            </div>
          ))}
        </Card>
      </section>

      {/* top lugares */}
      <Card title="Top lugares por interacciones">
        {top.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay interacciones registradas.</p>
        ) : (
          <ol className="space-y-1.5">
            {top.map(({ place, n }, i) => (
              <li key={place.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/admin/places/${place.id}`} className="inline-flex min-w-0 items-center gap-2 text-fg hover:text-goospe-green">
                  <span className="text-muted">{i + 1}.</span> <span className="truncate">{place.name}</span>
                </Link>
                <span className="font-medium text-goospe-green">{n}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

const INTERACTION_LABELS: { kind: string; label: string; icon: LucideIcon }[] = [
  { kind: 'view_card', label: 'Apariciones en feed', icon: Eye },
  { kind: 'view_detail', label: 'Vistas de ficha', icon: Eye },
  { kind: 'save', label: 'Guardados', icon: Heart },
  { kind: 'directions', label: 'Cómo llego', icon: Compass },
  { kind: 'share', label: 'Compartidos', icon: Share2 },
  { kind: 'concierge_pick', label: 'Elegido por conserje', icon: Sparkles },
]

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: LucideIcon; label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-goospe-green/30 bg-goospe-green/[0.06]' : 'border-line bg-card'}`}>
      <Icon size={18} strokeWidth={1.75} className="text-goospe-green" />
      <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
      <div className="text-xs font-medium text-fg-soft">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

function Pending({ href, icon: Icon, label, n }: { href: string; icon: LucideIcon; label: string; n: number }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-goospe-green/40">
      <span className="inline-flex items-center gap-2 text-sm text-fg-soft"><Icon size={17} strokeWidth={1.75} /> {label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${n > 0 ? 'bg-goospe-green/15 text-goospe-green-dark' : 'text-muted'}`}>{n}</span>
    </Link>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-fg-soft">{label}</span>
      <span className="font-medium text-fg">{a} <span className="text-muted">· {b}</span></span>
    </div>
  )
}
