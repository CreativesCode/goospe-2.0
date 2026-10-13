// Analítica de producto para el equipo (/admin/product). Módulo puro, con tests
// (tests/product-metrics.test.ts). Los agregados vienen de las RPC admin_active_users,
// admin_weekly_usage y admin_retention_cohorts (migración 0043); aquí solo se calculan tasas,
// se rellenan semanas sin actividad y se decide cuándo un porcentaje es fiable.

// Los días y semanas se cortan en UNA zona de reporte (hay ciudades en Chile y en España y una
// persona debe caer en un solo día). Es la del piloto; cambiarla mueve los cortes, no los totales.
export const REPORT_TZ = 'America/Santiago'

/** Con menos actores que esto en la base, un porcentaje es ruido: se muestra la fracción. */
export const MIN_BASE = 10

export type DailyRow = { day: string; dau: number; wau: number; mau: number }
export type WeeklyRow = {
  week: string
  actors: number; signed_in: number; anonymous: number
  visits: number; deciders: number; decided_visits: number; decisions: number
}
export type CohortRow = {
  cohort_week: string; actors: number; signed_in: number
  d1_eligible: number; d1: number
  d7_eligible: number; d7: number
  d30_eligible: number; d30: number
}

export type Rate = {
  /** Porcentaje 0–100 con un decimal; null si la base es 0 (todavía no se puede medir). */
  pct: number | null
  n: number
  base: number
  /** Base por debajo de MIN_BASE: enseñar "n de base" y no fiarse del %. */
  low: boolean
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function rate(n: unknown, base: unknown, minBase = MIN_BASE): Rate {
  const b = num(base)
  const top = Math.min(num(n), b) // nunca más del 100 %
  return { pct: b > 0 ? Math.round((top / b) * 1000) / 10 : null, n: top, base: b, low: b < minBase }
}

export const fmtRate = (r: Rate) => (r.pct == null ? '—' : `${r.pct.toLocaleString('es-CL')} %`)

// ── fechas (YYYY-MM-DD, aritmética en UTC: sin zonas ni horario de verano) ────────────────────
const toUtc = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  const d = toUtc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

/** Lunes de la semana de `day` (las semanas van de lunes a domingo, como date_trunc('week')). */
export function weekStart(day: string): string {
  const d = toUtc(day)
  const dow = (d.getUTCDay() + 6) % 7 // lunes = 0
  return addDays(iso(d), -dow)
}

/** Fecha de hoy en la zona de reporte. */
export function todayIn(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return iso(now)
  }
}

export const fmtWeek = (week: string) => {
  const d = toUtc(week)
  return `${d.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getUTCMonth()]}`
}

// ── uso semanal y métrica norte ──────────────────────────────────────────────────────────────
const EMPTY_WEEK = { actors: 0, signed_in: 0, anonymous: 0, visits: 0, deciders: 0, decided_visits: 0, decisions: 0 }

/**
 * Las `weeks` últimas semanas hasta la de `today`, de la más reciente a la más antigua, con
 * ceros donde la RPC no devolvió fila (una semana sin actividad no aparece en el SQL).
 */
export function fillWeeks(rows: WeeklyRow[], weeks: number, today: string): WeeklyRow[] {
  const byWeek = new Map(rows.map((r) => [String(r.week).slice(0, 10), r]))
  const current = weekStart(today)
  const out: WeeklyRow[] = []
  for (let i = 0; i < weeks; i++) {
    const week = addDays(current, -7 * i)
    const r = byWeek.get(week)
    out.push(r
      ? {
          week, actors: num(r.actors), signed_in: num(r.signed_in), anonymous: num(r.anonymous),
          visits: num(r.visits), deciders: num(r.deciders), decided_visits: num(r.decided_visits), decisions: num(r.decisions),
        }
      : { week, ...EMPTY_WEEK })
  }
  return out
}

/**
 * Métrica norte (doc 02): % de visitas que terminan en una decisión (guardar, cómo llego,
 * llamar / WhatsApp / email o RSVP). "Visita" = un actor en un día.
 */
export const decisionRate = (w: Pick<WeeklyRow, 'visits' | 'decided_visits'>): Rate => rate(w.decided_visits, w.visits)

/** Variación en puntos porcentuales entre dos tasas; null si alguna no se puede medir. */
export function pointsDelta(now: Rate, before: Rate): number | null {
  if (now.pct == null || before.pct == null) return null
  return Math.round((now.pct - before.pct) * 10) / 10
}

/** Stickiness: qué parte de los activos del mes viene un día cualquiera (DAU / MAU). */
export const stickiness = (d: Pick<DailyRow, 'dau' | 'mau'>): Rate => rate(d.dau, d.mau)

// ── retención ───────────────────────────────────────────────────────────────────────────────
export type CohortRetention = { week: string; actors: number; signedIn: number; d1: Rate; d7: Rate; d30: Rate }

export function cohortRetention(r: CohortRow): CohortRetention {
  return {
    week: String(r.cohort_week).slice(0, 10),
    actors: num(r.actors),
    signedIn: num(r.signed_in),
    d1: rate(r.d1, r.d1_eligible),
    d7: rate(r.d7, r.d7_eligible),
    d30: rate(r.d30, r.d30_eligible),
  }
}

/**
 * Retención global: suma de quienes volvieron entre la suma de quienes YA pudieron volver.
 * No es el promedio de los % de cada cohorte (eso daría el mismo peso a una cohorte de 2
 * personas que a una de 200).
 */
export function overallRetention(rows: CohortRow[]): { d1: Rate; d7: Rate; d30: Rate } {
  const sum = (k: keyof CohortRow) => rows.reduce((acc, r) => acc + num(r[k]), 0)
  return {
    d1: rate(sum('d1'), sum('d1_eligible')),
    d7: rate(sum('d7'), sum('d7_eligible')),
    d30: rate(sum('d30'), sum('d30_eligible')),
  }
}
