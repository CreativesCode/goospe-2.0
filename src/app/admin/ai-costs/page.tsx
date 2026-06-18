import Link from 'next/link'
import { Sparkles, Coins, Hash, Download } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DAY = 86400_000
const fmtUsd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const fmtDate = (s: string) => new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDay = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })

type Usage = {
  feature: string; model: string
  input_tokens: number; output_tokens: number; cached_tokens: number | null
  cost_usd: number; user_id: string | null; business_id: string | null; created_at: string
}

const RANGES = [
  { key: '7', label: '7 días', days: 7 },
  { key: '30', label: '30 días', days: 30 },
  { key: 'all', label: 'Todo', days: null as number | null },
]

export default async function GastosIaPage({ searchParams }: { searchParams: Promise<{ range?: string; page?: string }> }) {
  const sp = await searchParams
  const range = sp.range ?? '30'
  const days = RANGES.find((r) => r.key === range)?.days ?? 30
  const admin = createAdminClient()

  const { data } = await admin
    .from('ai_usage')
    .select('feature, model, input_tokens, output_tokens, cached_tokens, cost_usd, user_id, business_id, created_at')
    .order('created_at', { ascending: false })
  const all = (data ?? []) as Usage[]
  const since = days ? Date.now() - days * DAY : 0
  const rows = days ? all.filter((r) => new Date(r.created_at).getTime() >= since) : all

  const tokIn = (r: Usage) => r.input_tokens ?? 0
  const tokOut = (r: Usage) => r.output_tokens ?? 0
  const tokCached = (r: Usage) => r.cached_tokens ?? 0

  const total = {
    usd: rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    in: rows.reduce((s, r) => s + tokIn(r), 0),
    out: rows.reduce((s, r) => s + tokOut(r), 0),
    cached: rows.reduce((s, r) => s + tokCached(r), 0),
    n: rows.length,
  }

  // agrupar por una clave
  function groupBy(key: (r: Usage) => string) {
    const m = new Map<string, { usd: number; tok: number; n: number }>()
    for (const r of rows) {
      const k = key(r) || '—'
      const g = m.get(k) ?? { usd: 0, tok: 0, n: 0 }
      g.usd += Number(r.cost_usd ?? 0); g.tok += tokIn(r) + tokOut(r); g.n += 1
      m.set(k, g)
    }
    return [...m.entries()].sort((a, b) => b[1].usd - a[1].usd)
  }
  const byFeature = groupBy((r) => r.feature)
  const byModel = groupBy((r) => r.model)
  const byUser = groupBy((r) => r.user_id ?? '—')

  // serie por día
  const dayMap = new Map<string, number>()
  for (const r of rows) {
    const d = r.created_at.slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + Number(r.cost_usd ?? 0))
  }
  const series = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30)
  const maxDay = Math.max(0.000001, ...series.map(([, v]) => v))

  // nombres de usuarios para los grupos / detalle
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const { data: profs } = userIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }
  const userName = Object.fromEntries(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name || 'Usuario']))

  const PAGE = 60
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1))
  const detail = rows.slice((page - 1) * PAGE, page * PAGE)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-fg">Gastos de IA</h1>
          <p className="text-sm text-fg-soft">Tokens y costo (USD) de cada llamada a los modelos.</p>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 rounded-full border border-line bg-card p-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/ai-costs?range=${r.key}`}
                className={`rounded-full px-3 py-1 font-medium transition ${range === r.key ? 'bg-goospe-green/10 text-goospe-green-dark' : 'text-fg-soft hover:text-fg'}`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <a href="/admin/ai-costs/export" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium text-fg-soft transition hover:text-fg">
            <Download size={15} /> CSV
          </a>
        </div>
      </header>

      {/* totales */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Coins} label="Costo total" value={fmtUsd(total.usd)} accent />
        <Kpi icon={Hash} label="Tokens (in + out)" value={fmtTok(total.in + total.out)} hint={`${fmtTok(total.in)} in · ${fmtTok(total.out)} out · ${fmtTok(total.cached)} cache`} />
        <Kpi icon={Sparkles} label="Llamadas" value={total.n} />
        <Kpi icon={Coins} label="Costo / llamada" value={total.n ? fmtUsd(total.usd / total.n) : '$0'} />
      </section>

      {/* serie por día */}
      <Card title="Costo por día">
        {series.length === 0 ? (
          <p className="text-sm text-muted">Sin datos en el rango.</p>
        ) : (
          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {series.map(([d, v]) => (
              <div key={d} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${fmtDay(d)}: ${fmtUsd(v)}`}>
                <div className="w-full rounded-t bg-goospe-green/70 transition group-hover:bg-goospe-green" style={{ height: `${Math.max(2, (v / maxDay) * 100)}%` }} />
                <span className="text-[9px] text-muted">{fmtDay(d).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* desgloses */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Breakdown title="Por feature" rows={byFeature} />
        <Breakdown title="Por modelo" rows={byModel} />
      </section>

      <Breakdown title="Por usuario" rows={byUser.map(([id, g]) => [id === '—' ? 'Sistema / anónimo' : userName[id] ?? id.slice(0, 8), g] as [string, typeof g])} />

      {/* detalle */}
      <Card title={`Detalle · ${rows.length} llamadas`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Feature</th>
                <th className="py-2 pr-3 font-medium">Modelo</th>
                <th className="py-2 pr-3 text-right font-medium">In</th>
                <th className="py-2 pr-3 text-right font-medium">Out</th>
                <th className="py-2 pr-3 text-right font-medium">USD</th>
                <th className="py-2 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="py-2 pr-3 text-muted">{fmtDate(r.created_at)}</td>
                  <td className="py-2 pr-3 text-fg">{r.feature}</td>
                  <td className="py-2 pr-3 text-fg-soft">{r.model}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{fmtTok(tokIn(r))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{fmtTok(tokOut(r))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium text-fg">{fmtUsd(Number(r.cost_usd ?? 0))}</td>
                  <td className="py-2 text-fg-soft">{r.user_id ? userName[r.user_id] ?? '—' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Página {page} de {pages}</span>
            <div className="flex items-center gap-2">
              <PageLink range={range} page={page - 1} disabled={page <= 1}>Anterior</PageLink>
              <PageLink range={range} page={page + 1} disabled={page >= pages}>Siguiente</PageLink>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function PageLink({ range, page, disabled, children }: { range: string; page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-full border border-line px-3 py-1 text-muted opacity-50">{children}</span>
  return (
    <Link href={`/admin/ai-costs?range=${range}&page=${page}`} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-fg-soft transition hover:text-fg">
      {children}
    </Link>
  )
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: typeof Coins; label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-goospe-green/30 bg-goospe-green/[0.06]' : 'border-line bg-card'}`}>
      <Icon size={18} strokeWidth={1.75} className="text-goospe-green" />
      <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
      <div className="text-xs font-medium text-fg-soft">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
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

function Breakdown({ title, rows }: { title: string; rows: [string, { usd: number; tok: number; n: number }][] }) {
  const max = Math.max(0.000001, ...rows.map(([, g]) => g.usd))
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Sin datos.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(([k, g]) => (
            <li key={k}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-fg">{k}</span>
                <span className="shrink-0 font-medium text-fg">{fmtUsd(g.usd)} <span className="text-muted">· {fmtTok(g.tok)} tok · {g.n}×</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-goospe-green/70" style={{ width: `${(g.usd / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
