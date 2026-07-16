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

// ─── Humanizador: `opening_hours` de OSM → líneas legibles en español ───────────
const OSM_DAY_ES: Record<string, string> = {
  Mo: 'Lun', Tu: 'Mar', We: 'Mié', Th: 'Jue', Fr: 'Vie', Sa: 'Sáb', Su: 'Dom',
}

function humanizeDays(spec: string): string {
  const parts: string[] = []
  for (const tok of spec.split(',')) {
    const m = tok.trim().match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/)
    if (!m) continue
    const a = OSM_DAY_ES[m[1]]
    if (!a) continue
    parts.push(m[2] && OSM_DAY_ES[m[2]] ? `${a} a ${OSM_DAY_ES[m[2]]}` : a)
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
  for (const rule of raw.split(';')) {
    const r = rule.trim()
    if (!r) continue
    const timeIdx = r.search(/\d{1,2}:\d{2}/)
    if (/\boff\b|\bclosed\b/i.test(r)) {
      const daySpec = (timeIdx < 0 ? r.replace(/\b(off|closed)\b/i, '') : r.slice(0, timeIdx)).trim()
      lines.push(`${humanizeDays(daySpec) || 'Todos los días'}: Cerrado`)
      continue
    }
    if (timeIdx < 0) continue
    const times = humanizeTimes(r.slice(timeIdx).trim())
    if (!times) continue
    const daySpec = r.slice(0, timeIdx).trim()
    lines.push(`${humanizeDays(daySpec) || 'Todos los días'}: ${times}`)
  }
  return lines.length ? lines : null
}

// "Ahora" en la zona de la ciudad (zona del piloto → America/Santiago).
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
