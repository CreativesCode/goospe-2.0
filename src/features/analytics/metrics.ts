// Lógica pura de las estadísticas del dueño: definición de métricas, cubetas de tiempo en la
// zona de la ciudad y armado de las series a partir de lo que devuelve place_metrics_series.

export const RANGES = [7, 30, 90] as const
export type RangeDays = (typeof RANGES)[number]
export const GROUPS = ['day', 'hour', 'dow'] as const
export type Group = (typeof GROUPS)[number]
export type SeriesRow = { bucket: string; kind: string; n: number }

export type MetricKey =
  | 'view_detail' | 'view_card' | 'save' | 'directions' | 'share'
  | 'call' | 'concierge_pick' | 'rsvp' | 'review'

/** `kinds` = valores de `kind` que devuelve la RPC y que suman en esta métrica. */
export const METRICS: { key: MetricKey; label: string; kinds: string[] }[] = [
  { key: 'view_detail', label: 'Vistas de ficha', kinds: ['view_detail'] },
  { key: 'view_card', label: 'Apariciones en feed', kinds: ['view_card'] },
  { key: 'save', label: 'Guardados', kinds: ['save'] },
  { key: 'directions', label: 'Cómo llego', kinds: ['directions'] },
  { key: 'share', label: 'Compartidos', kinds: ['share'] },
  { key: 'call', label: 'Contactos', kinds: ['call_phone', 'call_whatsapp', 'call_email', 'call_other'] },
  { key: 'concierge_pick', label: 'Elegido por el conserje', kinds: ['concierge_pick'] },
  { key: 'rsvp', label: 'Inscritos a eventos', kinds: ['rsvp'] },
  { key: 'review', label: 'Reseñas nuevas', kinds: ['review'] },
]

export const GROUP_LABEL: Record<Group, string> = { day: 'Por día', hour: 'Por hora', dow: 'Por día de la semana' }
export const CHANNEL_LABEL: Record<string, string> = {
  call_phone: 'Llamadas', call_whatsapp: 'WhatsApp', call_email: 'Email', call_other: 'Otro',
}

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const isRange = (v: unknown): v is RangeDays => RANGES.includes(v as RangeDays)
export const isGroup = (v: unknown): v is Group => GROUPS.includes(v as Group)

/** Fecha de hoy (YYYY-MM-DD) en la zona de la ciudad. Zona inválida o vacía -> UTC. */
export function todayInZone(tz: string | null | undefined, now: Date = new Date()): string {
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  try {
    return fmt(tz || 'UTC')
  } catch {
    return fmt('UTC')
  }
}

/** Los últimos `days` días calendario de la ciudad, del más antiguo a hoy (igual que la RPC). */
export function dayKeys(days: number, tz: string | null | undefined, now: Date = new Date()): string[] {
  const [y, m, d] = todayInZone(tz, now).split('-').map(Number)
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10))
  }
  return out
}

/** Cubetas completas (también las que no tuvieron actividad) para la agrupación elegida. */
export function bucketKeys(group: Group, days: number, tz: string | null | undefined, now: Date = new Date()): string[] {
  if (group === 'hour') return Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
  if (group === 'dow') return ['0', '1', '2', '3', '4', '5', '6']
  return dayKeys(days, tz, now)
}

export function bucketLabel(group: Group, key: string): string {
  if (group === 'hour') return `${Number(key)} h`
  if (group === 'dow') return DOW[Number(key)] ?? key
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${MONTH[m - 1] ?? ''}`.trim()
}

const kindsOf = (metric: MetricKey): string[] => METRICS.find((m) => m.key === metric)?.kinds ?? []

/** Valores de una métrica alineados con `keys` (0 donde no hubo actividad). */
export function buildSeries(rows: SeriesRow[], metric: MetricKey, keys: string[]): number[] {
  const kinds = new Set(kindsOf(metric))
  const byBucket = new Map<string, number>()
  for (const r of rows) {
    if (kinds.has(r.kind)) byBucket.set(r.bucket, (byBucket.get(r.bucket) ?? 0) + Number(r.n))
  }
  return keys.map((k) => byBucket.get(k) ?? 0)
}

/** Total del rango por métrica. */
export function metricTotals(rows: SeriesRow[]): Record<MetricKey, number> {
  const byKind = kindTotals(rows)
  const out = {} as Record<MetricKey, number>
  for (const m of METRICS) out[m.key] = m.kinds.reduce((s, k) => s + (byKind[k] ?? 0), 0)
  return out
}

/** Total del rango por `kind` crudo (para desglosar los contactos por canal). */
export function kindTotals(rows: SeriesRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + Number(r.n)
  return out
}

/** Tope "redondo" del eje Y (1, 2, 5 × 10ⁿ), nunca menor que 4 para que haya líneas enteras. */
export function niceMax(max: number): number {
  if (max <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 5, 10]) if (max <= step * pow) return step * pow
  return 10 * pow
}

/** Qué etiquetas del eje X se muestran: todas si caben; si no, repartidas e incluyendo la última. */
export function tickIndexes(count: number, maxTicks: number): number[] {
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i)
  const step = Math.ceil((count - 1) / (maxTicks - 1))
  const out: number[] = []
  for (let i = count - 1; i >= 0; i -= step) out.unshift(i)
  return out
}

/** Sanea lo que llega de la RPC (bigint como texto, filas raras) antes de mandarlo al cliente. */
export function normalizeRows(data: unknown): SeriesRow[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((r) => {
    const row = (r ?? {}) as { bucket?: unknown; kind?: unknown; n?: unknown }
    const n = Number(row.n)
    return typeof row.bucket === 'string' && typeof row.kind === 'string' && Number.isFinite(n)
      ? [{ bucket: row.bucket, kind: row.kind, n }]
      : []
  })
}
