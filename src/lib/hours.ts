// Evaluador ligero de `opening_hours` de OSM (subconjunto suficiente para los datos del piloto:
// "24/7", "09:00-21:00", "Mo-Fr 08:00-20:30; Sa 09:00-20:30", "Fr,Sa 12:00-22:00",
// rangos nocturnos "18:00-02:00"). No cubre festivos ni reglas raras; ante duda devuelve null.

const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] // índice 0..6
// JS getDay(): Su=0..Sa=6 → índice OSM
const JS_TO_OSM = [6, 0, 1, 2, 3, 4, 5]

function expandDays(spec: string): Set<number> {
  const out = new Set<number>()
  for (const tok of spec.split(',')) {
    const t = tok.trim()
    if (!t) continue
    const m = t.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/)
    if (!m) continue
    const a = OSM_DAYS.indexOf(m[1])
    if (a < 0) continue
    if (!m[2]) { out.add(a); continue }
    const b = OSM_DAYS.indexOf(m[2])
    if (b < 0) continue
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break } // soporta wrap Sa-Su, etc.
  }
  return out
}

function inTimeRanges(spec: string, minutes: number): boolean {
  for (const r of spec.split(',')) {
    const m = r.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
    if (!m) continue
    const start = +m[1] * 60 + +m[2]
    let end = +m[3] * 60 + +m[4]
    if (end === 0) end = 24 * 60
    if (end <= start) {
      // cruza medianoche (ej. 18:00-02:00): abierto antes de medianoche o en la madrugada
      if (minutes >= start || minutes < end) return true
    } else if (minutes >= start && minutes < end) {
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

  let parsedAny = false
  for (const rule of raw.split(';')) {
    const r = rule.trim()
    if (!r || /\boff\b|\bclosed\b/i.test(r)) continue
    const timeIdx = r.search(/\d{1,2}:\d{2}/)
    if (timeIdx < 0) continue
    const daySpec = r.slice(0, timeIdx).trim()
    const timeSpec = r.slice(timeIdx).trim()
    parsedAny = true
    const days = daySpec ? expandDays(daySpec) : new Set([0, 1, 2, 3, 4, 5, 6])
    if (!days.has(osmDay)) continue
    if (inTimeRanges(timeSpec, minutes)) return true
  }
  return parsedAny ? false : null
}

// "Ahora" en la zona de la ciudad (Puerto Varas → America/Santiago).
export function cityNowParts(tz = 'America/Santiago'): { osmDay: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { osmDay: map[wd] ?? JS_TO_OSM[new Date().getDay()], minutes: hh * 60 + mm }
}
