// Zona horaria POR CIUDAD (cities.timezone). Nunca se asume una zona fija: producción corre
// en UTC y hay ciudades en Chile, Canarias y la península. Sirve en cliente y servidor.

type Tz = string | null | undefined

// Zona válida o undefined (→ Intl usa la del entorno). Un valor corrupto no debe tumbar el render.
function safeTz(tz: Tz): string | undefined {
  if (!tz) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return undefined
  }
}

/**
 * Formatea un instante en la zona de la ciudad. Reloj de 24 h siempre (es-CL usa a. m./p. m.
 * por defecto y el servidor y el navegador no coinciden → error de hidratación).
 */
export function fmtInZone(iso: string, tz: Tz, opts: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', {
    ...opts,
    ...(opts.hour ? { hourCycle: 'h23' as const } : {}),
    timeZone: safeTz(tz),
  }).format(d)
}

/** Zona del equipo que opera el backoffice: las fechas de /admin no dependen del servidor (UTC). */
export const ADMIN_TZ = 'America/Santiago'

// Componentes de reloj de pared de un instante en una zona.
function wallParts(t: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour') % 24, mi: n('minute'), s: n('second') }
}

// Desfase (ms) de la zona respecto de UTC en el instante `t`.
function offsetMs(t: number, tz: string): number {
  const p = wallParts(t, tz)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000
}

/**
 * Interpreta un valor de `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm") como hora de
 * pared en `tz` y devuelve el instante real. `new Date(valor)` lo interpretaría en la zona
 * del SERVIDOR (UTC en producción): ese era el bug de la hora de los eventos.
 */
export function zonedTimeToUtc(local: string, tz: Tz): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(local ?? '')
  if (!m) return null
  const zone = safeTz(tz) ?? 'UTC'
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  // Dos pasadas: la segunda corrige el desfase cuando la hora cae cerca de un cambio de horario.
  let t = asUtc - offsetMs(asUtc, zone)
  t = asUtc - offsetMs(t, zone)
  return Number.isNaN(t) ? null : new Date(t)
}

/** Instante -> valor de `datetime-local` ("YYYY-MM-DDTHH:mm") en la zona: inverso de zonedTimeToUtc. */
export function isoToLocalInZone(iso: string, tz: Tz): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const p = wallParts(t, safeTz(tz) ?? 'UTC')
  const z = (v: number) => String(v).padStart(2, '0')
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`
}

/** "Ahora" en la zona, con el formato de `datetime-local` (para el atributo `min`). */
export function nowLocalInZone(tz: Tz): string {
  const p = wallParts(Date.now(), safeTz(tz) ?? 'UTC')
  const z = (v: number) => String(v).padStart(2, '0')
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`
}

/** Día OSM (Mo=0..Su=6) y minutos del día en la zona de la ciudad. */
export function zoneNowParts(tz: Tz): { osmDay: number; minutes: number } {
  const zone = safeTz(tz)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { osmDay: map[wd] ?? 0, minutes: hh * 60 + mm }
}
