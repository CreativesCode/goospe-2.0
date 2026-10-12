import { compose, type Block, type EmailContent } from '@/emails/layout'

// Informe semanal (con resumen de la IA) y resumen de números (sin IA). Un email por negocio:
// si administra varios lugares, cada uno va en su sección.

export const METRIC_LABELS: Record<string, string> = {
  view_card: 'Apariciones en el feed',
  view_detail: 'Vistas de tu ficha',
  save: 'Guardados',
  directions: 'Pidieron cómo llegar',
  call: 'Llamadas',
  whatsapp: 'WhatsApp',
  share: 'Compartidos',
  rsvp: 'Se apuntaron a un evento',
  concierge_pick: 'Recomendado por el conserje',
}
// Orden de lectura; lo que no esté aquí (unsave, dismiss…) no se muestra al dueño.
const METRIC_ORDER = ['view_detail', 'view_card', 'save', 'directions', 'call', 'whatsapp', 'share', 'rsvp', 'concierge_pick']

const nf = new Intl.NumberFormat('es-CL')

export type ReportPlace = {
  name: string
  /** Resumen de la IA; null en el resumen de números. */
  summary: string | null
  metrics: Record<string, number>
  newReviews: number
  panelUrl: string
}

export type ReportEmailProps = {
  businessName: string
  /** "6 al 12 de octubre". */
  periodLabel: string
  places: ReportPlace[]
  panelUrl: string
  unsubscribeUrl: string | null
}

export function metricRows(metrics: Record<string, number>, newReviews: number): { label: string; value: string }[] {
  const rows = METRIC_ORDER
    .filter((k) => (metrics[k] ?? 0) > 0)
    .map((k) => ({ label: METRIC_LABELS[k], value: nf.format(metrics[k]) }))
  if (newReviews > 0) rows.push({ label: 'Reseñas nuevas', value: nf.format(newReviews) })
  return rows
}

function placeBlocks(p: ReportPlace, withName: boolean, withSummary: boolean): Block[] {
  const rows = metricRows(p.metrics, p.newReviews)
  return [
    ...(withName ? [{ type: 'heading' as const, text: p.name }] : []),
    ...(withSummary && p.summary ? [{ type: 'text' as const, text: p.summary }] : []),
    ...(rows.length ? [{ type: 'stats' as const, rows }] : []),
    ...(withName ? [{ type: 'link' as const, label: `Ver el panel de ${p.name}`, url: p.panelUrl }] : []),
  ]
}

const unsubscribe = (url: string | null, label: string) => (url ? { url, label } : null)

/** Informe semanal: resumen de la IA + números + enlace al panel. */
export function weeklyReportEmail(p: ReportEmailProps): EmailContent {
  const many = p.places.length > 1
  const title = many ? p.businessName : p.places[0]?.name ?? p.businessName
  return compose({
    subject: `Tu semana en Goospe: ${title}`,
    preheader: `Cómo le fue a ${title} del ${p.periodLabel}.`,
    heading: 'Tu semana en 5 líneas',
    blocks: [
      { type: 'p', text: `Así le fue a ${title} del ${p.periodLabel}.` },
      ...p.places.flatMap((pl) => placeBlocks(pl, many, true)),
    ],
    cta: { label: 'Abrir mi panel', url: p.panelUrl },
    note: 'El resumen lo escribe una IA con los números de tu ficha: úsalo como guía, no como verdad absoluta.',
    unsubscribe: unsubscribe(p.unsubscribeUrl, 'Dejar de recibir el informe semanal'),
  })
}

/** Resumen de números sin IA (mismos datos, sin texto generado). */
export function numbersDigestEmail(p: ReportEmailProps): EmailContent {
  const many = p.places.length > 1
  const title = many ? p.businessName : p.places[0]?.name ?? p.businessName
  return compose({
    subject: `Tus números de la semana: ${title}`,
    preheader: `Lo que pasó con ${title} del ${p.periodLabel}.`,
    heading: 'Tus números de la semana',
    blocks: [
      { type: 'p', text: `Esto pasó con ${title} del ${p.periodLabel}.` },
      ...p.places.flatMap((pl) => placeBlocks(pl, many, false)),
    ],
    cta: { label: 'Ver el detalle en mi panel', url: p.panelUrl },
    unsubscribe: unsubscribe(p.unsubscribeUrl, 'Dejar de recibir el resumen de números'),
  })
}
