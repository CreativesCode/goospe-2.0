import Link from 'next/link'
import { ArrowRight, ChevronRight, Circle, CircleCheck, Sparkles } from 'lucide-react'
import { fmtInZone } from '@/lib/tz'
import { ReviewRow, type OwnerReview } from '@/features/business/ReviewReplies'
import { completionPct, type ChecklistItem } from '@/features/business/completeness'
import { tabHref } from '@/features/business/panel-tabs'

const card = 'min-w-0 rounded-[22px] border border-line bg-card px-[22px] py-5'
const cardTitle = 'text-[15px] font-medium text-fg'
const MAX_PENDING = 3

/** Tarjeta oscura con el último informe semanal de la IA (se genera y se lee entero en Estadísticas). */
export function ReportCard({ placeId, report, timeZone }: {
  placeId: string; report: { summary: string; created_at: string } | null; timeZone: string | null
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-[22px] bg-deep p-[22px] text-deep-soft">
      <h2 className="flex items-center gap-[7px] text-[13px] font-medium text-goospe-green-light">
        <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" /> Informe semanal IA
      </h2>
      {report ? (
        <p className="mt-3 line-clamp-6 whitespace-pre-line text-[15px] leading-[1.6] text-[#F3EFE8]">{report.summary}</p>
      ) : (
        <p className="mt-3 text-[15px] leading-[1.6] text-[#F3EFE8]">Aún no tienes un informe. Genera el primero para ver cómo le fue a tu lugar esta semana.</p>
      )}
      {report?.created_at && <p className="mt-2 text-xs">Generado el {fmtInZone(report.created_at, timeZone, { day: 'numeric', month: 'long' })}</p>}
      <Link href={`${tabHref(placeId, 'estadisticas')}#informe`} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-[13px] font-medium text-goospe-green-light hover:underline">
        {report ? 'Ver informe completo' : 'Generar informe'} <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </section>
  )
}

/**
 * Reseñas sin respuesta del negocio: se contestan aquí mismo (a mano o con la sugerencia de la
 * IA). Lleva el ancla `#resenas`, que es a donde apuntan los avisos por correo de reseña nueva.
 */
export function PendingReviewsCard({ placeId, reviews, count, timeZone }: {
  placeId: string; reviews: OwnerReview[]; count: number; timeZone: string | null
}) {
  const pending = reviews.filter((r) => !r.owner_reply).slice(0, MAX_PENDING)
  return (
    <section id="resenas" className={`scroll-mt-28 ${card}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cardTitle}>Reseñas por responder</h2>
        {count > 0 && <span className="rounded-full bg-goospe-green px-[9px] py-[3px] text-xs font-medium text-on-brand">{count}</span>}
      </div>
      {pending.length === 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-sm text-fg-soft">Estás al día: no hay reseñas esperando respuesta.</p>
      ) : (
        <ul className="mt-3">
          {pending.map((r) => <ReviewRow key={r.id} placeId={placeId} r={r} timeZone={timeZone} plain />)}
        </ul>
      )}
      <Link href={tabHref(placeId, 'resenas')} className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink hover:underline">
        Ver todas las reseñas <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </section>
  )
}

/** "Completa tu ficha": progreso real de la ficha y enlaces a lo que falta. */
export function ChecklistCard({ placeId, items }: { placeId: string; items: ChecklistItem[] }) {
  const pct = completionPct(items)
  const row = 'flex items-center gap-2.5 border-t border-line py-2.5 text-sm'
  return (
    <section className={card}>
      <h2 className={cardTitle}>Completa tu ficha</h2>
      <div role="progressbar" aria-label="Ficha completada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-[linear-gradient(90deg,#28af79,#27f1a0)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[13px] text-fg-soft">
        {pct}% · {pct === 100 ? 'tu ficha está completa' : 'una ficha completa ayuda a que te elijan'}
      </p>
      <ul className="mt-3">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className={`${row} text-fg-soft`}>
                <CircleCheck size={17} strokeWidth={1.75} className="shrink-0 text-goospe-green" aria-hidden="true" />
                <span className="line-through">{item.label}</span><span className="sr-only"> (listo)</span>
              </span>
            ) : (
              <Link href={tabHref(placeId, item.tab)} className={`${row} text-fg transition hover:text-ink`}>
                <Circle size={17} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
