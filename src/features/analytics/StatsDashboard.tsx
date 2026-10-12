'use client'

import { useMemo, useState, useTransition } from 'react'
import { Eye, Smartphone, Heart, Compass, Share2, Sparkles, Star, Phone, Ticket, MessageSquare, type LucideIcon } from 'lucide-react'
import { getPlaceSeries } from '@/actions/analytics'
import { toast } from '@/shared/components/toast'
import { BarChart, fmtNum } from '@/features/analytics/BarChart'
import {
  CHANNEL_LABEL, GROUPS, GROUP_LABEL, METRICS, RANGES, bucketKeys, bucketLabel, buildSeries, kindTotals, metricTotals,
  type Group, type MetricKey, type RangeDays, type SeriesRow,
} from '@/features/analytics/metrics'

const ICON: Record<MetricKey, LucideIcon> = {
  view_detail: Eye, view_card: Smartphone, save: Heart, directions: Compass, share: Share2,
  call: Phone, concierge_pick: Sparkles, rsvp: Ticket, review: MessageSquare,
}
const UNIT: Record<MetricKey, string> = {
  view_detail: 'vistas', view_card: 'apariciones', save: 'guardados', directions: 'veces', share: 'veces',
  call: 'contactos', concierge_pick: 'veces', rsvp: 'inscritos', review: 'reseñas',
}
const GROUP_SHORT: Record<Group, string> = { day: 'Día', hour: 'Hora', dow: 'Semana' }
const seg = (on: boolean) =>
  `min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition sm:flex-none ${on ? 'bg-goospe-green text-white' : 'text-fg-soft hover:text-fg'}`
const segWrap = 'flex rounded-full border border-line bg-surface p-0.5'

/**
 * Estadísticas del lugar: totales del rango + serie de la métrica elegida. Los cortes de día y
 * hora ya vienen calculados en la zona horaria de la ciudad; aquí solo se rellenan las cubetas
 * vacías. No incluye la actividad del propio equipo del negocio.
 */
export function StatsDashboard({ placeId, timeZone, cityName, initialRows, initialOk, savesTotal, rating, reviewsCount }: {
  placeId: string; timeZone: string | null; cityName: string | null
  initialRows: SeriesRow[]; initialOk: boolean; savesTotal: number; rating: number; reviewsCount: number
}) {
  const [days, setDays] = useState<RangeDays>(30)
  const [group, setGroup] = useState<Group>('day')
  const [metric, setMetric] = useState<MetricKey>('view_detail')
  const [rows, setRows] = useState<SeriesRow[]>(initialRows)
  const [ok, setOk] = useState(initialOk)
  const [loading, startTransition] = useTransition()

  function reload(nextDays: RangeDays, nextGroup: Group) {
    setDays(nextDays); setGroup(nextGroup)
    startTransition(async () => {
      const res = await getPlaceSeries({ placeId, days: nextDays, group: nextGroup })
      if ('error' in res) { toast.error(res.error ?? 'No pudimos cargar las estadísticas'); return }
      setRows(res.rows); setOk(true)
    })
  }

  const totals = useMemo(() => metricTotals(rows), [rows])
  const channels = useMemo(() => kindTotals(rows), [rows])
  const keys = useMemo(() => bucketKeys(group, days, timeZone), [group, days, timeZone])
  const values = useMemo(() => buildSeries(rows, metric, keys), [rows, metric, keys])
  const labels = useMemo(() => keys.map((k) => bucketLabel(group, k)), [keys, group])
  const current = METRICS.find((m) => m.key === metric) ?? METRICS[0]
  const contactParts = current.kinds.filter((k) => (channels[k] ?? 0) > 0).map((k) => `${CHANNEL_LABEL[k]} ${fmtNum(channels[k])}`)

  return (
    <section id="estadisticas" className="scroll-mt-32 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-fg">Estadísticas</h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div role="group" aria-label="Rango de fechas" className={`${segWrap} flex-1 sm:flex-none`}>
            {RANGES.map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => reload(d, group)} className={seg(days === d)}>{d} días</button>
            ))}
          </div>
          <div role="group" aria-label="Agrupar por" className={`${segWrap} flex-1 sm:flex-none`}>
            {GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={group === g} aria-label={GROUP_LABEL[g]} onClick={() => reload(days, g)} className={seg(group === g)}>{GROUP_SHORT[g]}</button>
            ))}
          </div>
        </div>
      </div>

      {!ok ? (
        <p className="mt-4 text-sm text-muted">No pudimos cargar las estadísticas en este momento. Intenta de nuevo en unos minutos.</p>
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div role="group" aria-label="Métrica del gráfico" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {METRICS.map(({ key, label }) => {
              const Icon = ICON[key]
              const on = key === metric
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => setMetric(key)}
                  className={`rounded-xl border p-3 text-left transition ${on ? 'border-goospe-green bg-goospe-green/5 ring-1 ring-goospe-green' : 'border-transparent bg-surface hover:border-line'}`}>
                  <Icon size={17} strokeWidth={1.75} className="text-goospe-green" aria-hidden="true" />
                  <span className="mt-1 block text-2xl font-semibold tabular-nums text-fg">{fmtNum(totals[key])}</span>
                  <span className="block text-xs text-fg-soft">{label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5">
            <BarChart title={`${current.label} · ${GROUP_LABEL[group].toLowerCase()}`} unit={UNIT[metric]} labels={labels} values={values} />
            {metric === 'call' && contactParts.length > 0 && <p className="mt-1 text-xs text-fg-soft">Por canal: {contactParts.join(' · ')}</p>}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-sm text-fg-soft">
        <span className="inline-flex items-center gap-1.5"><Heart size={15} strokeWidth={1.75} className="text-goospe-green" /> {fmtNum(savesTotal)} guardados en total</span>
        <span className="inline-flex items-center gap-1.5"><Star size={15} strokeWidth={1.75} className="text-goospe-green" fill="currentColor" /> {Number(rating).toFixed(1)} · {reviewsCount} {reviewsCount === 1 ? 'reseña' : 'reseñas'}</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Últimos {days} días, hora de {cityName ?? 'la ciudad del lugar'}. No cuenta tus propias visitas con sesión iniciada.
      </p>
    </section>
  )
}
