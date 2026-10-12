// Editor de horario del dueño: semana estructurada <-> `opening_hours` de OSM. Se guarda en
// places.hours con el MISMO formato que ya leen isOpenNow / humanizeHours ({ osm_raw }).
import { z } from 'zod'
import { expandDays, splitRules } from '@/lib/hours'

export type TimeRange = { from: string; to: string } // "HH:MM" (24 h)
export type DaySchedule = { closed: boolean; ranges: TimeRange[] }
/** Semana Lun..Dom (índice 0..6, igual que los días de OSM). */
export type WeekSchedule = DaySchedule[]
/** unset = sin horario publicado · always = abierto 24 h · custom = por día. */
export type HoursMode = 'unset' | 'always' | 'custom'
export type HoursInput = { mode: HoursMode; days: WeekSchedule }
export type StoredHours = { osm_raw: string; source: 'owner' }

export const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const MAX_RANGES_PER_DAY = 3

const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const RANGE_RE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/
const TIME_RE = /\d{1,2}:\d{2}/
const OFF_RE = /\b(off|closed)\b/i

export const emptyWeek = (): WeekSchedule =>
  Array.from({ length: 7 }, () => ({ closed: true, ranges: [] }))

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

// Tramo en minutos; el que cruza medianoche (22:00-02:00) termina "mañana". 00:00 de cierre = 24:00.
function span(r: TimeRange): [number, number] {
  const a = toMin(r.from)
  const b = toMin(r.to)
  return [a, b <= a ? b + 1440 : b]
}

/** Primer problema de la semana en texto legible, o null si es válida. */
export function validateWeek(days: WeekSchedule): string | null {
  if (days.length !== 7) return 'El horario debe tener los 7 días'
  for (let i = 0; i < 7; i++) {
    const d = days[i]
    if (d.closed) continue
    if (!d.ranges.length) return `${DAY_LABELS[i]}: agrega un tramo o márcalo como cerrado`
    if (d.ranges.length > MAX_RANGES_PER_DAY) return `${DAY_LABELS[i]}: máximo ${MAX_RANGES_PER_DAY} tramos`
    for (const r of d.ranges) {
      if (!HHMM.test(r.from) || !HHMM.test(r.to)) return `${DAY_LABELS[i]}: completa las horas`
      if (r.from === r.to) return `${DAY_LABELS[i]}: la apertura y el cierre no pueden ser iguales`
    }
    const spans = d.ranges.map(span).sort((a, b) => a[0] - b[0])
    for (let k = 1; k < spans.length; k++) {
      if (spans[k][0] < spans[k - 1][1]) return `${DAY_LABELS[i]}: los tramos se solapan`
    }
  }
  return null
}

const daySpec = (d: DaySchedule): string =>
  d.closed
    ? 'off'
    : [...d.ranges].sort((a, b) => toMin(a.from) - toMin(b.from)).map((r) => `${r.from}-${r.to}`).join(',')

// Índices de día -> "Mo-Fr" / "Mo,We" / "Mo-We,Fr" (rachas consecutivas como rango).
function daysToOsm(idx: number[]): string {
  const out: string[] = []
  for (let i = 0; i < idx.length; i++) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++
    out.push(j - i >= 2 ? `${OSM_DAYS[idx[i]]}-${OSM_DAYS[idx[j]]}` : idx.slice(i, j + 1).map((n) => OSM_DAYS[n]).join(','))
    i = j
  }
  return out.join(',')
}

/** Semana -> cadena OSM. Los días con el mismo horario se agrupan ("Mo-Fr 09:00-18:00; Sa,Su off"). */
export function weekToOsm(days: WeekSchedule): string {
  const groups = new Map<string, number[]>()
  days.forEach((d, i) => {
    const spec = daySpec(d)
    groups.set(spec, [...(groups.get(spec) ?? []), i])
  })
  // Los cerrados van PRIMERO: isOpenNow aplica "off" sobre lo ya evaluado, y puesto al final
  // apagaría la madrugada de un tramo nocturno del día anterior ("Fr 22:00-02:00; Sa off").
  const entries = [...groups.entries()].sort((a, b) => Number(b[0] === 'off') - Number(a[0] === 'off') || a[1][0] - b[1][0])
  if (entries.length === 1) return `Mo-Su ${entries[0][0]}`
  return entries.map(([spec, idx]) => `${daysToOsm(idx)} ${spec}`).join('; ')
}

/** Lo que se guarda en places.hours (null = sin horario). */
export function toStoredHours(input: HoursInput): StoredHours | null {
  if (input.mode === 'unset') return null
  if (input.mode === 'always') return { osm_raw: '24/7', source: 'owner' }
  if (input.days.every((d) => d.closed)) return { osm_raw: 'Mo-Su off', source: 'owner' }
  return { osm_raw: weekToOsm(input.days), source: 'owner' }
}

const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`

function parseRanges(spec: string): TimeRange[] | null {
  const out: TimeRange[] = []
  for (const part of spec.split(',')) {
    const m = part.trim().match(RANGE_RE)
    if (!m) return null
    if (+m[1] > 24 || +m[3] > 24) return null
    // 24:00 no existe en <input type="time">: se muestra como 00:00 (medianoche).
    const from = pad(+m[1] === 24 ? '0' : m[1], m[2])
    const to = pad(+m[3] === 24 ? '0' : m[3], m[4])
    if (!HHMM.test(from) || !HHMM.test(to)) return null
    out.push({ from, to })
  }
  return out.length ? out : null
}

/**
 * Cadena OSM -> estado del editor. Devuelve null si trae algo que el editor no sabe representar
 * (festivos, meses, "sunrise"…): la UI lo avisa y parte de una semana vacía en vez de perder
 * datos en silencio. Los días que la cadena no menciona quedan cerrados (así los lee isOpenNow).
 */
export function osmToHoursInput(raw: string | null | undefined): HoursInput | null {
  const text = raw?.trim()
  if (!text) return { mode: 'unset', days: emptyWeek() }
  if (text === '24/7') return { mode: 'always', days: emptyWeek() }

  const days = emptyWeek()
  for (const rule of splitRules(text)) {
    const timeIdx = rule.search(TIME_RE)
    const isOff = OFF_RE.test(rule)
    if (timeIdx < 0 && !isOff) return null
    const spec = (timeIdx < 0 ? rule.replace(OFF_RE, '') : rule.slice(0, timeIdx)).trim()
    const set = spec ? expandDays(spec) : new Set([0, 1, 2, 3, 4, 5, 6])
    if (!set || set.size === 0) return null // meses, fechas o solo festivos
    if (/\b(PH|SH|FP)\b/.test(spec)) return null
    const ranges = isOff ? [] : parseRanges(rule.slice(timeIdx).trim())
    if (!ranges) return null
    for (const d of set) {
      days[d] = isOff
        ? { closed: true, ranges: [] }
        : { closed: false, ranges: [...days[d].ranges, ...ranges].slice(0, MAX_RANGES_PER_DAY + 1) }
    }
  }
  return validateWeek(days) ? null : { mode: 'custom', days }
}

const rangeSchema = z.object({ from: z.string().regex(HHMM), to: z.string().regex(HHMM) })
const daySchema = z.object({ closed: z.boolean(), ranges: z.array(rangeSchema).max(MAX_RANGES_PER_DAY) })

/** Validación de servidor del horario que envía el editor (campo `hours`, JSON). */
export const hoursInputSchema = z
  .object({ mode: z.enum(['unset', 'always', 'custom']), days: z.array(daySchema).length(7) })
  .superRefine((v, ctx) => {
    const problem = v.mode === 'custom' ? validateWeek(v.days) : null
    if (problem) ctx.addIssue({ code: 'custom', message: `Horario — ${problem}` })
  })

/** Campo de formulario (JSON en texto) -> objeto para el schema. Texto inválido -> undefined. */
export function parseHoursField(value: unknown): unknown {
  if (typeof value !== 'string' || !value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
