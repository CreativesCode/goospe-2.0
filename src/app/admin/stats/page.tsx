import Link from 'next/link'
import { Eye, ScrollText, Heart, Compass, Share2, Sparkles, CalendarCheck, type LucideIcon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const KINDS: { kind: string; label: string; icon: LucideIcon }[] = [
  { kind: 'view_card', label: 'Apariciones en feed', icon: Eye },
  { kind: 'view_detail', label: 'Vistas de ficha', icon: ScrollText },
  { kind: 'save', label: 'Guardados', icon: Heart },
  { kind: 'directions', label: 'Cómo llego', icon: Compass },
  { kind: 'share', label: 'Compartidos', icon: Share2 },
  { kind: 'rsvp', label: 'RSVPs a eventos', icon: CalendarCheck },
  { kind: 'concierge_pick', label: 'Elegido por conserje', icon: Sparkles },
]

export default async function AdminStatsPage() {
  const admin = createAdminClient()
  const arpc = admin.rpc.bind(admin) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>

  // Todo agregado en SQL: no se descarga `interactions`.
  const [totalRes, countsRes, rankRes] = await Promise.all([
    admin.from('interactions').select('*', { count: 'exact', head: true }),
    arpc('admin_interaction_counts'),
    arpc('admin_top_places', { p_limit: 10, p_value_only: true }),
  ])

  const total = totalRes.count ?? 0
  const countsRows = (countsRes.data ?? []) as { kind: string; total: number; d30: number; d7: number }[]
  const byKindMap = Object.fromEntries(countsRows.map((r) => [r.kind, r])) as Record<string, { total: number; d30: number; d7: number }>
  const byKind = (k: string) => {
    const r = byKindMap[k]
    return { total: Number(r?.total ?? 0), d30: Number(r?.d30 ?? 0), d7: Number(r?.d7 ?? 0) }
  }

  // funnel
  const views = byKind('view_card').total
  const details = byKind('view_detail').total
  const actions = byKind('save').total + byKind('directions').total + byKind('share').total
  const funnel = [
    { label: 'Apariciones en feed', n: views },
    { label: 'Vistas de ficha', n: details },
    { label: 'Acciones (guardar / cómo llego / compartir)', n: actions },
  ]
  const maxFunnel = Math.max(1, views)

  // ranking de lugares por interacciones de valor (agregado + join en SQL)
  const ranking = ((rankRes.data ?? []) as { id: string; name: string; n: number }[]).map((r) => ({ id: r.id, name: r.name, n: Number(r.n) }))
  const maxRank = Math.max(1, ...ranking.map((r) => r.n))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Estadísticas</h1>
        <p className="text-sm text-fg-soft">Comportamiento global · {total} interacciones registradas.</p>
      </header>

      {/* por tipo */}
      <Card title="Interacciones por tipo">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 pr-3 text-right font-medium">30 días</th>
                <th className="py-2 text-right font-medium">7 días</th>
              </tr>
            </thead>
            <tbody>
              {KINDS.map(({ kind, label, icon: Icon }) => {
                const c = byKind(kind)
                return (
                  <tr key={kind} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3"><span className="inline-flex items-center gap-2 text-fg"><Icon size={15} strokeWidth={1.75} className="text-goospe-green" /> {label}</span></td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium text-fg">{c.total}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{c.d30}</td>
                    <td className="py-2 text-right tabular-nums text-fg-soft">{c.d7}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* funnel */}
      <Card title="Embudo de descubrimiento">
        <ul className="space-y-3">
          {funnel.map((f, i) => (
            <li key={f.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-fg">{f.label}</span>
                <span className="font-medium text-fg">{f.n}{i > 0 && views > 0 && <span className="ml-1 text-muted">· {((f.n / maxFunnel) * 100).toFixed(1)}%</span>}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-goospe-green/70" style={{ width: `${(f.n / maxFunnel) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* ranking */}
      <Card title="Top lugares por interacciones de valor">
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay interacciones registradas.</p>
        ) : (
          <ul className="space-y-2.5">
            {ranking.map((r, i) => (
              <li key={r.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/admin/places/${r.id}`} className="inline-flex min-w-0 items-center gap-2 text-fg hover:text-goospe-green">
                    <span className="text-muted">{i + 1}.</span> <span className="truncate">{r.name}</span>
                  </Link>
                  <span className="shrink-0 font-medium text-goospe-green">{r.n}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-goospe-green/70" style={{ width: `${(r.n / maxRank) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
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
