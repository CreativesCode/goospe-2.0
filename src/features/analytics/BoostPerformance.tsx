import { fmtInZone } from '@/lib/tz'
import type { BoostStat, EventBoostStat } from '@/features/analytics/load'
import { deltaVsPrevious } from '@/features/analytics/metrics'

const nf = new Intl.NumberFormat('es-CL')
const day = (s: string, tz: string | null) => fmtInZone(s, tz, { day: 'numeric', month: 'short' })

function stateOf(b: Pick<BoostStat, 'status' | 'ends_at' | 'ended_at'>, now: number): string {
  if (b.status === 'active' && new Date(b.ends_at).getTime() > now) return 'Activo'
  return b.ended_at ? 'Terminado antes' : 'Finalizado'
}

/** Rendimiento de cada boost del lugar mientras estuvo activo (presentacional, sin estado). */
export function BoostPerformance({ boosts, timeZone, now }: { boosts: BoostStat[]; timeZone: string | null; now: number }) {
  if (!boosts.length) return null
  return (
    <div className="mt-4 border-t border-goospe-green/20 pt-4">
      <h3 className="text-sm font-medium text-fg">Rendimiento de tus destacados</h3>
      <p className="text-xs text-muted">Apariciones en el feed y aperturas de tu ficha mientras cada destacado estuvo activo.</p>
      <ul className="mt-3 space-y-2">
        {boosts.map((b) => {
          const end = b.ended_at ?? b.ends_at
          const ctr = b.impressions > 0 ? `${((b.clicks / b.impressions) * 100).toFixed(1).replace('.', ',')} %` : '—'
          return (
            <li key={b.boost_id} className="rounded-xl bg-card p-3">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-soft">
                <span>{day(b.starts_at, timeZone)} – {day(end, timeZone)}</span>
                <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium text-fg-soft">{stateOf(b, now)}</span>
              </p>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                {[
                  ['Impresiones', nf.format(b.impressions)],
                  ['Clics', nf.format(b.clicks)],
                  ['Clics / impr.', ctr],
                  ['Acciones', nf.format(b.actions)],
                ].map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col-reverse">
                    <dt className="truncate text-[10px] text-muted">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-fg">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Acciones: cómo llegar, contacto, guardar y compartir.</p>
    </div>
  )
}

const TREND: Record<string, string> = {
  up: 'text-goospe-green-dark', down: 'text-red-600 dark:text-red-400', flat: 'text-muted', none: 'text-muted',
}

/**
 * Rendimiento de cada EVENTO destacado: números del propio evento mientras estuvo destacado,
 * comparados con el periodo de igual duración justo antes (presentacional, sin estado).
 */
export function EventBoostPerformance({ boosts, timeZone, now }: { boosts: EventBoostStat[]; timeZone: string | null; now: number }) {
  if (!boosts.length) return null
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-fg">Rendimiento de tus eventos destacados</h3>
      <p className="text-xs text-muted">Actividad de cada evento mientras estuvo destacado, frente al periodo de igual duración justo antes.</p>
      <ul className="mt-3 space-y-2">
        {boosts.map((b) => {
          const end = b.ended_at ?? b.ends_at
          const cells: [string, number, number][] = [
            ['Impresiones', b.impressions, b.prev_impressions],
            ['Aperturas', b.opens, b.prev_opens],
            ['Inscritos', b.rsvps, b.prev_rsvps],
          ]
          return (
            <li key={b.boost_id} className="rounded-xl bg-surface p-3">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-soft">
                <span className="min-w-0 [overflow-wrap:anywhere]"><strong className="font-medium text-fg">{b.event_name}</strong> · {day(b.starts_at, timeZone)} – {day(end, timeZone)}</span>
                <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium text-fg-soft">{stateOf(b, now)}</span>
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {cells.map(([label, value, previous]) => {
                  const delta = deltaVsPrevious(value, previous)
                  return (
                    <div key={label} className="flex min-w-0 flex-col-reverse">
                      <dt className="truncate text-[10px] text-muted">{label}</dt>
                      <dd>
                        <span className="block text-lg font-semibold tabular-nums text-fg">{nf.format(value)}</span>
                        {b.comparable && (
                          <span className={`block text-[11px] tabular-nums ${TREND[delta.trend]}`}>
                            {delta.text} <span className="text-muted">(antes {nf.format(previous)})</span>
                          </span>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
              {!b.comparable && <p className="mt-1 text-[11px] text-muted">Sin periodo previo comparable: el evento se creó hace poco.</p>}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Impresiones: veces que la card del evento se vio en el feed. Aperturas: veces que desde ella se abrió tu ficha. Inscritos: personas que se apuntaron y siguen apuntadas.</p>
    </div>
  )
}
