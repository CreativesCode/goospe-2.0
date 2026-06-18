import Link from 'next/link'
import { Eye, ScrollText, Heart, Compass, Share2, Sparkles, CalendarCheck, type LucideIcon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DAY = 86400_000

type Inter = { kind: string; place_id: string | null; created_at: string }

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
  const since7 = Date.now() - 7 * DAY
  const since30 = Date.now() - 30 * DAY

  const { data } = await admin.from('interactions').select('kind, place_id, created_at')
  const rows = (data ?? []) as Inter[]

  const count = (pred: (r: Inter) => boolean) => rows.filter(pred).length
  const byKind = (k: string) => ({
    total: count((r) => r.kind === k),
    d30: count((r) => r.kind === k && new Date(r.created_at).getTime() >= since30),
    d7: count((r) => r.kind === k && new Date(r.created_at).getTime() >= since7),
  })

  // funnel
  const views = count((r) => r.kind === 'view_card')
  const details = count((r) => r.kind === 'view_detail')
  const actions = count((r) => ['save', 'directions', 'share'].includes(r.kind))
  const funnel = [
    { label: 'Apariciones en feed', n: views },
    { label: 'Vistas de ficha', n: details },
    { label: 'Acciones (guardar / cómo llego / compartir)', n: actions },
  ]
  const maxFunnel = Math.max(1, views)

  // ranking de lugares por interacciones (acciones de valor)
  const valueKinds = new Set(['view_detail', 'save', 'directions', 'share'])
  const byPlace: Record<string, number> = {}
  for (const r of rows) if (r.place_id && valueKinds.has(r.kind)) byPlace[r.place_id] = (byPlace[r.place_id] ?? 0) + 1
  const topIds = Object.entries(byPlace).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const { data: placesData } = topIds.length
    ? await admin.from('places').select('id, name').in('id', topIds.map(([id]) => id))
    : { data: [] }
  const nameById = Object.fromEntries(((placesData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))
  const ranking = topIds.map(([id, n]) => ({ id, name: nameById[id] ?? '—', n }))
  const maxRank = Math.max(1, ...ranking.map((r) => r.n))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Estadísticas</h1>
        <p className="text-sm text-fg-soft">Comportamiento global · {rows.length} interacciones registradas.</p>
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
