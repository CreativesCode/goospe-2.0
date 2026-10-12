import { isoToLocalInZone, zonedTimeToUtc } from '@/lib/tz'

// Semana del informe programado. Módulo puro (se prueba sin BD).
//
// El informe cubre la última semana CERRADA, de lunes a domingo, en la zona horaria de la
// ciudad del negocio. Su inicio (`start`, "YYYY-MM-DD") es la clave de idempotencia: da igual
// el día o la hora en que corra el cron dentro de la semana siguiente, la clave es la misma.

export type WeekPeriod = {
  /** Lunes de la semana cerrada, fecha local "YYYY-MM-DD". Clave del periodo. */
  start: string
  /** Domingo de esa semana, fecha local. */
  end: string
  /** Rango exacto [fromIso, toIso) en UTC. */
  fromIso: string
  toIso: string
  /** Día local de HOY: 1 = lunes … 7 = domingo. */
  weekday: number
}

const DAY_MS = 86_400_000
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)

export function lastClosedWeek(now: Date, tz: string | null | undefined): WeekPeriod {
  const zone = tz || 'UTC'
  const local = isoToLocalInZone(now.toISOString(), zone) // "YYYY-MM-DDTHH:mm" en la zona
  const [y, m, d] = local.slice(0, 10).split('-').map(Number)
  const todayUtc = Date.UTC(y, m - 1, d) // la fecha local como si fuera UTC: solo para aritmética de días
  const weekday = ((new Date(todayUtc).getUTCDay() + 6) % 7) + 1
  const thisMonday = todayUtc - (weekday - 1) * DAY_MS
  const start = ymd(thisMonday - 7 * DAY_MS)
  const from = zonedTimeToUtc(`${start}T00:00`, zone)
  const to = zonedTimeToUtc(`${ymd(thisMonday)}T00:00`, zone)
  return {
    start,
    end: ymd(thisMonday - DAY_MS),
    fromIso: (from ?? new Date(thisMonday - 7 * DAY_MS)).toISOString(),
    toIso: (to ?? new Date(thisMonday)).toISOString(),
    weekday,
  }
}

/**
 * Días en que corre el informe: el lunes (el envío) y martes/miércoles solo para terminar lo
 * que el lunes dejó pendiente (tope de IA o de tiempo, o un cron que no corrió). Como la clave
 * es la semana, esos días no regeneran ni reenvían nada de lo ya hecho.
 */
export const isWeeklyRunDay = (weekday: number) => weekday >= 1 && weekday <= 3

/**
 * Clave del email: como mucho uno por negocio, semana y destinatario (sea informe o resumen).
 * La del informe guardado es el índice único business_reports_scheduled_uidx
 * (negocio + lugar + tipo + period_start), con el mismo inicio de semana.
 */
export const weeklyEmailKey = (businessId: string, periodStart: string, userId: string) =>
  `weekly:${businessId}:${periodStart}:${userId}`

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "6 al 12 de octubre" / "29 de septiembre al 5 de octubre". */
export function periodLabel(start: string, end: string): string {
  const [, sm, sd] = start.split('-').map(Number)
  const [, em, ed] = end.split('-').map(Number)
  return sm === em ? `${sd} al ${ed} de ${MONTHS[em - 1]}` : `${sd} de ${MONTHS[sm - 1]} al ${ed} de ${MONTHS[em - 1]}`
}

/** ¿Hubo algo que contar? Lo que no le dice nada al dueño (descartes, des-guardados) no cuenta. */
const SILENT_KINDS = new Set(['dismiss', 'unsave'])
export function activityTotal(metrics: Record<string, number>, newReviews: number): number {
  return Object.entries(metrics).reduce((sum, [k, n]) => (SILENT_KINDS.has(k) ? sum : sum + n), 0) + newReviews
}
