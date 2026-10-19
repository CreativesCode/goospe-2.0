import { Compass, Eye, Heart, Share2, type LucideIcon } from 'lucide-react'
import { OverviewChart } from '@/features/analytics/OverviewChart'
import { buildSeries, dayKeys, deltaVsPrevious, type Delta, type MetricKey, type SeriesRow } from '@/features/analytics/metrics'
import { ChecklistCard, PendingReviewsCard, ReportCard } from '@/features/business/OverviewCards'
import { listingChecklist } from '@/features/business/completeness'
import type { PanelPlace } from '@/features/business/panel-data'
import type { OwnerReview } from '@/features/business/ReviewReplies'

const nf = new Intl.NumberFormat('es-CL')
/** Días de la serie que se cargan: cubre el selector 7/30/90 del gráfico y la semana previa de los KPIs. */
export const OVERVIEW_DAYS = 90
const WEEK = 7

const KPIS: { key: MetricKey; label: string; icon: LucideIcon }[] = [
  { key: 'view_detail', label: 'Vistas', icon: Eye },
  { key: 'save', label: 'Guardados', icon: Heart },
  { key: 'directions', label: 'Cómo llego', icon: Compass },
  { key: 'share', label: 'Compartidos', icon: Share2 },
]

const sum = (values: number[]) => values.reduce((s, n) => s + n, 0)
const DELTA_TONE: Record<Delta['trend'], string> = { up: 'text-ink', down: 'text-fg-soft', flat: 'text-muted', none: 'text-muted' }

/** KPI de los últimos 7 días con su variación frente a los 7 anteriores (ambos de la misma serie real). */
function Kpi({ label, icon: Icon, value, delta }: { label: string; icon: LucideIcon; value: number | null; delta: Delta | null }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-[18px]">
      <div className="flex items-center justify-between gap-2 text-[13px] text-fg-soft">
        <span className="flex items-center gap-1.5"><Icon size={15} strokeWidth={1.75} className="text-ink" aria-hidden="true" />{label}</span>
        {delta && delta.trend !== 'none' && (
          <span className={`font-medium ${DELTA_TONE[delta.trend]}`} title="Frente a los 7 días anteriores">
            {delta.text}<span className="sr-only"> frente a los 7 días anteriores</span>
          </span>
        )}
      </div>
      <div className="mt-2.5 text-[34px] font-light leading-none tracking-[-0.02em] text-fg tabular-nums">{value === null ? '—' : nf.format(value)}</div>
    </div>
  )
}

/**
 * Vista "Resumen" del panel: KPIs de la semana, vistas por día, informe de la IA, reseñas por
 * responder y progreso de la ficha. Todo sale de datos reales (serie de `place_metrics_series`,
 * `business_reports`, reseñas y campos del lugar); `now` es el "ahora" del servidor.
 */
export function PanelOverview({ place, series, reviews, pendingReviews, report, now }: {
  place: PanelPlace
  series: { ok: boolean; rows: SeriesRow[] }
  reviews: OwnerReview[]
  pendingReviews: number
  report: { summary: string; created_at: string } | null
  now: number
}) {
  const tz = place.cities?.timezone ?? null
  const keys = dayKeys(OVERVIEW_DAYS, tz, new Date(now))
  const week = keys.slice(-WEEK)
  const prevWeek = keys.slice(-2 * WEEK, -WEEK)
  const total = (metric: MetricKey, ks: string[]) => sum(buildSeries(series.rows, metric, ks))

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
        {KPIS.map(({ key, label, icon }) => (
          <Kpi key={key} label={label} icon={icon}
            value={series.ok ? total(key, week) : null}
            delta={series.ok ? deltaVsPrevious(total(key, week), total(key, prevWeek)) : null} />
        ))}
      </div>
      {!series.ok && <p className="text-sm text-muted">No pudimos cargar las estadísticas en este momento. Intenta de nuevo en unos minutos.</p>}

      <div className={`grid gap-[18px] ${series.ok ? 'min-[900px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : ''}`}>
        {series.ok && <OverviewChart title="Vistas por día" unit="vistas" keys={keys} values={buildSeries(series.rows, 'view_detail', keys)} />}
        <ReportCard placeId={place.id} report={report} timeZone={tz} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-[18px]">
        <PendingReviewsCard placeId={place.id} reviews={reviews} count={pendingReviews} timeZone={tz} />
        <ChecklistCard placeId={place.id} items={listingChecklist(place)} />
      </div>
      <p className="text-xs text-muted">
        Hora de {place.cities?.name ?? 'la ciudad del lugar'}. Las cifras no cuentan tus propias visitas con sesión iniciada.
      </p>
    </>
  )
}
