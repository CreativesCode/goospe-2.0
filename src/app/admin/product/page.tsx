import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import {
  MIN_BASE, REPORT_TZ, cohortRetention, decisionRate, fillWeeks, fmtRate, fmtWeek, overallRetention,
  pointsDelta, stickiness, todayIn,
  type CohortRow, type DailyRow, type Rate, type WeeklyRow,
} from '@/features/admin/product-metrics'

export const metadata: Metadata = { title: 'Producto' }

export const dynamic = 'force-dynamic'

const WEEKS = 12

export default async function AdminProductPage() {
  await requireAdmin('/admin/product') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()

  // Todo agregado en SQL (RPC solo service_role, migración 0043): no se descarga `interactions`.
  const [dailyRes, weeklyRes, cohortRes] = await Promise.all([
    admin.rpc('admin_active_users', { p_days: 30, p_tz: REPORT_TZ }),
    admin.rpc('admin_weekly_usage', { p_weeks: WEEKS, p_tz: REPORT_TZ }),
    admin.rpc('admin_retention_cohorts', { p_weeks: WEEKS, p_tz: REPORT_TZ }),
  ])
  const failed = dailyRes.error ?? weeklyRes.error ?? cohortRes.error
  if (failed) {
    console.error('[admin/product] rpc:', failed.message)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium text-fg">Producto</h1>
        <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-fg">
          No pudimos calcular las métricas de producto. Si acabas de desplegar, falta aplicar la migración 0043.
        </p>
      </div>
    )
  }

  const today = todayIn(REPORT_TZ)
  const daily = (dailyRes.data ?? []) as DailyRow[]
  const weeks = fillWeeks((weeklyRes.data ?? []) as WeeklyRow[], WEEKS, today)
  const cohortRows = (cohortRes.data ?? []) as CohortRow[]
  const cohorts = cohortRows.map(cohortRetention)
  const overall = overallRetention(cohortRows)

  const latest = daily[daily.length - 1] ?? { day: today, dau: 0, wau: 0, mau: 0 }
  // La semana en curso está incompleta: la referencia es la última semana cerrada.
  const [current, lastFull, previous] = weeks
  const north = decisionRate(lastFull ?? current)
  const northDelta = previous && lastFull ? pointsDelta(north, decisionRate(previous)) : null
  const stick = stickiness(latest)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Producto</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-soft">
          Uso, retención y métrica norte. Días y semanas (lunes a domingo) en hora de {REPORT_TZ.split('/')[1]?.replace('_', ' ')}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Métrica norte · visitas con decisión"
          value={fmtRate(north)}
          note={lastFull
            ? `Semana del ${fmtWeek(lastFull.week)}: ${north.n} de ${north.base} visitas${northDelta == null ? '' : ` · ${northDelta > 0 ? '+' : ''}${northDelta.toLocaleString('es-CL')} pts vs. la anterior`}`
            : 'Sin semanas cerradas todavía'}
          low={north.low}
        />
        <Tile label="Usuarios con decisión · semana cerrada" value={String(lastFull?.deciders ?? 0)} note={`${current?.deciders ?? 0} en la semana en curso`} />
        <Tile label="Activos · 7 días (WAU)" value={String(latest.wau)} note={`${latest.dau} hoy (DAU)`} />
        <Tile label="Activos · 30 días (MAU)" value={String(latest.mau)} note={`Recurrencia DAU/MAU ${fmtRate(stick)}`} low={stick.low} />
      </div>

      <Card title="Retención global (todas las cohortes mostradas)">
        <div className="grid gap-4 sm:grid-cols-3">
          <RetentionTile label="D1 · volvió al día siguiente o después" r={overall.d1} />
          <RetentionTile label="D7 · volvió a los 7 días o después" r={overall.d7} />
          <RetentionTile label="D30 · volvió a los 30 días o después" r={overall.d30} />
        </div>
      </Card>

      <Card title="Uso por semana">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Semana del</th>
                <th className="py-2 pr-3 text-right font-medium">Activos</th>
                <th className="py-2 pr-3 text-right font-medium">Con sesión</th>
                <th className="py-2 pr-3 text-right font-medium">Anónimos</th>
                <th className="py-2 pr-3 text-right font-medium">Visitas</th>
                <th className="py-2 pr-3 text-right font-medium">Con decisión</th>
                <th className="py-2 pr-3 text-right font-medium">% norte</th>
                <th className="py-2 text-right font-medium">Decisiones</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const r = decisionRate(w)
                return (
                  <tr key={w.week} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3 text-fg">{fmtWeek(w.week)}{i === 0 && <span className="ml-2 text-xs text-muted">en curso</span>}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-fg">{w.actors}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{w.signed_in}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{w.anonymous}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{w.visits}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{w.decided_visits}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${r.low ? 'text-muted' : 'font-medium text-goospe-green'}`}>{fmtRate(r)}</td>
                    <td className="py-2 text-right tabular-nums text-fg-soft">{w.decisions}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Retención por cohorte semanal (semana de la primera visita)">
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay usuarios nuevos en las últimas {WEEKS} semanas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Cohorte</th>
                  <th className="py-2 pr-3 text-right font-medium">Nuevos</th>
                  <th className="py-2 pr-3 text-right font-medium">Con sesión</th>
                  <th className="py-2 pr-3 text-right font-medium">D1</th>
                  <th className="py-2 pr-3 text-right font-medium">D7</th>
                  <th className="py-2 text-right font-medium">D30</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.week} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3 text-fg">{fmtWeek(c.week)}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-fg">{c.actors}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{c.signedIn}</td>
                    <RateCell r={c.d1} />
                    <RateCell r={c.d7} />
                    <RateCell r={c.d30} last />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Cómo se cuenta">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-soft">
          <li><b className="font-medium text-fg">Persona</b>: con sesión cuenta el usuario; sin sesión, el dispositivo. Si un dispositivo anónimo inicia sesión alguna vez, toda su actividad anónima se atribuye a ese usuario (no se cuenta dos veces). La misma persona anónima en dos dispositivos, o tras borrar los datos del navegador, cuenta como dos.</li>
          <li><b className="font-medium text-fg">Activo</b>: registró cualquier interacción (ver una card 2 s o más, abrir una ficha, guardar…).</li>
          <li><b className="font-medium text-fg">Visita</b>: una persona en un día. No hay identificador de sesión.</li>
          <li><b className="font-medium text-fg">Decisión</b>: guardar, cómo llego, llamar / WhatsApp / email o RSVP. La métrica norte es el % de visitas con al menos una.</li>
          <li><b className="font-medium text-fg">Retención DN</b>: de quienes llegaron hace N días o más, cuántos volvieron N días después de su primera visita o más tarde. La cifra de una cohorte puede subir con el tiempo.</li>
          <li>Con menos de {MIN_BASE} personas en la base el porcentaje sale en gris: léase la fracción.</li>
        </ul>
      </Card>
    </div>
  )
}

function RateCell({ r, last = false }: { r: Rate; last?: boolean }) {
  return (
    <td className={`py-2 text-right tabular-nums ${last ? '' : 'pr-3'}`}>
      {r.pct == null ? (
        <span className="text-muted" title="Aún no pasan los días necesarios">—</span>
      ) : (
        <>
          <span className={r.low ? 'text-muted' : 'font-medium text-fg'}>{fmtRate(r)}</span>
          <span className="ml-1.5 text-xs text-muted">{r.n}/{r.base}</span>
        </>
      )}
    </td>
  )
}

function RetentionTile({ label, r }: { label: string; r: Rate }) {
  return (
    <div>
      <div className={`text-3xl font-light tabular-nums ${r.low ? 'text-muted' : 'text-fg'}`}>{fmtRate(r)}</div>
      <div className="mt-1 text-xs text-fg-soft">{label}</div>
      <div className="text-xs text-muted">{r.base === 0 ? 'Aún sin base para medir' : `${r.n} de ${r.base} personas`}</div>
    </div>
  )
}

function Tile({ label, value, note, low = false }: { label: string; value: string; note: string; low?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`mt-2 text-3xl font-light tabular-nums ${low ? 'text-muted' : 'text-fg'}`}>{value}</div>
      <div className="mt-1 text-xs text-fg-soft">{note}</div>
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
