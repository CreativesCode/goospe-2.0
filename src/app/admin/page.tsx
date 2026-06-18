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
  const since7 = new Date(Date.now() - 7 * DAY).toISOString()
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()

  const [
    places, published, claimed,
    users, usersNew,
    reviewsPending, eventsPending, photosPending,
    interactions, ai, photoRows,
  ] = await Promise.all([
    admin.from('places').select('*', { count: 'exact', head: true }),
    admin.from('places').select('*', { count: 'exact', head: true }).eq('is_published', true),
    admin.from('places').select('*', { count: 'exact', head: true }).not('business_id', 'is', null),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since7),
    admin.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'blocked'),
    admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('place_photos').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('interactions').select('kind, place_id, created_at'),
    admin.from('ai_usage').select('cost_usd, input_tokens, output_tokens, cached_tokens, created_at'),
    admin.from('place_photos').select('place_id').eq('status', 'approved'),
  ])

  // interacciones por tipo
  const inter = (interactions.data ?? []) as { kind: string; place_id: string | null; created_at: string }[]
  const byKind = inter.reduce<Record<string, number>>((a, r) => ((a[r.kind] = (a[r.kind] ?? 0) + 1), a), {})

  // top 5 lugares por interacciones
  const byPlace = inter.reduce<Record<string, number>>((a, r) => {
    if (r.place_id) a[r.place_id] = (a[r.place_id] ?? 0) + 1
    return a
  }, {})
  const topIds = Object.entries(byPlace).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const { data: topPlacesData } = topIds.length
    ? await admin.from('places').select('id, name, slug').in('id', topIds.map(([id]) => id))
    : { data: [] }
  const topNames = Object.fromEntries(((topPlacesData ?? []) as { id: string; name: string; slug: string }[]).map((p) => [p.id, p]))
  const top = topIds.map(([id, n]) => ({ place: topNames[id], n })).filter((t) => t.place)

  // con foto (distinct)
  const withPhoto = new Set(((photoRows.data ?? []) as { place_id: string }[]).map((r) => r.place_id)).size

  // gasto IA
  const usage = (ai.data ?? []) as { cost_usd: number; input_tokens: number; output_tokens: number; cached_tokens: number | null; created_at: string }[]
  const sum = (rows: typeof usage) => ({
    usd: rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    tok: rows.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0),
    n: rows.length,
  })
  const aiTotal = sum(usage)
  const ai30 = sum(usage.filter((r) => r.created_at >= since30))
  const ai7 = sum(usage.filter((r) => r.created_at >= since7))

  // actividad diaria (últimos 14 días): interacciones por día
  const days14 = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10))
  const interByDay = inter.reduce<Record<string, number>>((a, r) => {
    const d = r.created_at.slice(0, 10)
    a[d] = (a[d] ?? 0) + 1
    return a
  }, {})
  const activity = days14.map((d) => ({ d, n: interByDay[d] ?? 0 }))
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
        <Kpi icon={Eye} label="Interacciones" value={inter.length} hint="todas las acciones" />
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
