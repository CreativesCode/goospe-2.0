// Evaluador ligero de `opening_hours` de OSM (subconjunto suficiente para los datos reales:
// "24/7", "09:00-21:00", "Mo-Fr 08:00-20:30; Sa 09:00-20:30", "Fr,Sa 12:00-22:00",
// reglas separadas por coma "Mo-Fr 07:00-24:00, Sa,Su 08:00-24:00", rangos nocturnos
// "18:00-02:00" y "Tu off"). No cubre festivos ni meses; ante duda devuelve null.
import { zoneNowParts } from '@/lib/tz'

const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] // índice 0..6
const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6])
const HOLIDAY = /^(PH|SH|FP)$/ // festivos: se ignoran (no se evalúan)
const TIME_RE = /\d{1,2}:\d{2}/
const OFF_RE = /\b(off|closed)\b/i

// Separa las reglas. OSM admite `;` y también `,` entre reglas; la coma además separa días
// ("Sa,Su") y franjas ("13:00-16:00,20:00-24:00"). Una coma abre regla nueva solo si lo
// acumulado ya trae horario (u "off") y lo que sigue empieza por un día, no por una hora.
function splitRules(raw: string): string[] {
  const out: string[] = []
  for (const semi of raw.split(';')) {
    let cur = ''
    for (const piece of semi.split(',')) {
      const done = cur !== '' && (TIME_RE.test(cur) || OFF_RE.test(cur))
      if (done && /^\s*[A-Za-z]/.test(piece)) {
        out.push(cur.trim())
        cur = piece
      } else {
        cur = cur === '' ? piece : `${cur},${piece}`
      }
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

// Días de una regla. null = hay algo que no entendemos (meses, fechas) → regla no evaluable.
function expandDays(spec: string): Set<number> | null {
  const out = new Set<number>()
  for (const tok of spec.split(',')) {
    const t = tok.trim()
    if (!t || HOLIDAY.test(t)) continue
    const m = t.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/)
    if (!m) return null
    const a = OSM_DAYS.indexOf(m[1])
    if (a < 0) return null
    if (!m[2]) { out.add(a); continue }
    const b = OSM_DAYS.indexOf(m[2])
    if (b < 0) return null
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break } // soporta wrap Sa-Su, etc.
  }
  return out // vacío = regla solo de festivos ("PH 10:00-14:00"): no aplica a ningún día normal
}

// ¿Abierto a `minutes` según las franjas? Un rango que cruza medianoche (18:00-02:00) pertenece
// al día en que EMPIEZA: la madrugada cuenta si la regla aplicaba ayer, no hoy.
function inTimeRanges(spec: string, minutes: number, today: boolean, yesterday: boolean): boolean {
  for (const r of spec.split(',')) {
    const m = r.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
    if (!m) continue
    const start = +m[1] * 60 + +m[2]
    let end = +m[3] * 60 + +m[4]
    if (end === 0) end = 24 * 60
    if (end <= start) {
      if ((today && minutes >= start) || (yesterday && minutes < end)) return true
    } else if (today && minutes >= start && minutes < end) {
      return true
    }
  }
  return false
}

// Devuelve true/false si se puede evaluar, o null si el horario es desconocido/no parseable.
export function isOpenNow(osmRaw: string | null | undefined, osmDay: number, minutes: number): boolean | null {
  if (!osmRaw) return null
  const raw = osmRaw.trim()
  if (!raw) return null
  if (raw === '24/7') return true

  const yesterday = (osmDay + 6) % 7
  let parsedAny = false
  let unknown = false
  let open = false
  for (const r of splitRules(raw)) {
    const timeIdx = r.search(TIME_RE)
    const isOff = OFF_RE.test(r)
    if (timeIdx < 0 && !isOff) continue
    const daySpec = (timeIdx < 0 ? r.replace(OFF_RE, '') : r.slice(0, timeIdx)).trim()
    const days = daySpec ? expandDays(daySpec) : ALL_DAYS
    if (!days) { unknown = true; continue }
    parsedAny = true
    if (isOff) {
      // "Tu off" pisa lo que dijeran las reglas anteriores para ese día.
      if (days.has(osmDay)) open = false
      continue
    }
    if (inTimeRanges(r.slice(timeIdx).trim(), minutes, days.has(osmDay), days.has(yesterday))) open = true
  }
  if (open) return true
  // Con reglas que no supimos leer no afirmamos "cerrado".
  return parsedAny && !unknown ? false : null
}

// ─── Humanizador: `opening_hours` de OSM → líneas legibles en español ───────────
const OSM_DAY_ES: Record<string, string> = {
  Mo: 'Lun', Tu: 'Mar', We: 'Mié', Th: 'Jue', Fr: 'Vie', Sa: 'Sáb', Su: 'Dom',
}

// null = no se pudo traducir (meses, fechas) → la UI muestra la regla cruda.
function humanizeDays(spec: string): string | null {
  const parts: string[] = []
  for (const tok of spec.split(',')) {
    const t = tok.trim()
    if (!t) continue
    if (HOLIDAY.test(t)) { parts.push('Festivos'); continue }
    const m = t.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/)
    if (!m) return null
    const a = OSM_DAY_ES[m[1]]
    if (!a) return null
    if (m[2] && !OSM_DAY_ES[m[2]]) return null
    parts.push(m[2] ? `${a} a ${OSM_DAY_ES[m[2]]}` : a)
  }
  return parts.join(', ')
}

function humanizeTimes(spec: string): string | null {
  const out: string[] = []
  for (const r of spec.split(',')) {
    const m = r.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
    if (!m) continue
    out.push(`${m[1].padStart(2, '0')}:${m[2]}–${m[3].padStart(2, '0')}:${m[4]}`)
  }
  return out.length ? out.join(' y ') : null
}

// Convierte el `opening_hours` de OSM a líneas legibles en español (ej.
// "Lun a Vie: 09:00–18:00", "Sáb: 10:00–14:00"). Devuelve null si no hay dato o
// no se puede parsear nada — en ese caso la UI puede caer al string crudo.
export function humanizeHours(osmRaw: string | null | undefined): string[] | null {
  if (!osmRaw) return null
  const raw = osmRaw.trim()
  if (!raw) return null
  if (raw === '24/7') return ['Abierto las 24 horas']

  const lines: string[] = []
  for (const r of splitRules(raw)) {
    const timeIdx = r.search(TIME_RE)
    const isOff = OFF_RE.test(r)
    if (timeIdx < 0 && !isOff) continue
    const daySpec = (timeIdx < 0 ? r.replace(OFF_RE, '') : r.slice(0, timeIdx)).trim()
    const days = daySpec ? humanizeDays(daySpec) : 'Todos los días'
    if (days === null) { lines.push(r); continue } // regla que no sabemos traducir: tal cual
    if (isOff) { lines.push(`${days || 'Todos los días'}: Cerrado`); continue }
    const times = humanizeTimes(r.slice(timeIdx).trim())
    if (!times) continue
    lines.push(`${days || 'Todos los días'}: ${times}`)
  }
  return lines.length ? lines : null
}

// "Ahora" en la zona de la CIUDAD del lugar (cities.timezone). Sin zona usa la del entorno.
export function cityNowParts(tz: string | null | undefined): { osmDay: number; minutes: number } {
  return zoneNowParts(tz)
}

/** Atajo: ¿abierto ahora este lugar? `hours` es el jsonb de places ({ osm_raw }). */
export function openNow(
  hours: { osm_raw?: string | null } | null | undefined,
  tz: string | null | undefined
): boolean | null {
  const raw = hours?.osm_raw
  if (!raw) return null
  const now = zoneNowParts(tz)
  return isOpenNow(raw, now.osmDay, now.minutes)
}
