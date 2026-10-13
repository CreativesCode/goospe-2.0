// "Agregar al calendario": archivo .ics (RFC 5545) y enlace de Google Calendar.
// Lógica pura (sin red ni entorno): las horas viajan SIEMPRE en UTC ("…Z"), así el calendario
// del usuario las muestra en su propia zona sin depender de VTIMEZONE.

export type CalendarEvent = {
  /** Identificador estable: reimportar el archivo actualiza el evento en vez de duplicarlo. */
  uid: string
  title: string
  description?: string | null
  location?: string | null
  /** Instante de inicio (ISO). */
  start: string
  /** Instante de fin (ISO). Sin él se usa `start` + `FALLBACK_DURATION_MS`. */
  end?: string | null
  url?: string | null
  /** Evento cancelado: el calendario lo tacha en vez de mostrarlo como vigente. */
  cancelled?: boolean
  /**
   * Última modificación del evento (ISO). Con ella el .ics lleva LAST-MODIFIED y SEQUENCE: al
   * reimportarlo, el calendario sabe que es una versión MÁS NUEVA del mismo UID (cambio de
   * hora, cancelación) y la aplica en vez de quedarse con la copia vieja.
   */
  updatedAt?: string | null
}

/** Sin hora de término, un evento se da por terminado 3 h después de empezar (como en el feed). */
export const FALLBACK_DURATION_MS = 3 * 3600_000

/** Instante de fin efectivo en ms (NaN si `start` no es una fecha). */
export function eventEndMs(start: string, end?: string | null): number {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : NaN
  return Number.isNaN(e) || e < s ? s + FALLBACK_DURATION_MS : e
}

/** Instante → "YYYYMMDDTHHMMSSZ". */
export function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/**
 * SEQUENCE (RFC 5545 §3.8.7.4) a partir de la fecha de modificación: segundos desde 2020-01-01.
 * No hay un contador de revisiones en la BD; el reloj sirve igual porque solo debe CRECER con
 * cada cambio y caber en un entero de 32 bits (alcanza hasta el año 2088).
 */
export const ICS_SEQUENCE_EPOCH_MS = Date.UTC(2020, 0, 1)
export function icsSequence(updatedMs: number): number {
  return Math.max(0, Math.floor((updatedMs - ICS_SEQUENCE_EPOCH_MS) / 1000))
}

/** Escapa un valor TEXT (RFC 5545 §3.3.11): barra invertida, punto y coma, coma y saltos de línea. */
export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const encoder = new TextEncoder()

/** Pliega una línea a 75 OCTETOS (no caracteres) sin partir un carácter multibyte. */
export function icsFold(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    // Las líneas de continuación empiezan con un espacio, que cuenta dentro de los 75.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

/** Devuelve el contenido del .ics, o null si la fecha de inicio no es válida. */
export function buildIcs(ev: CalendarEvent, now: Date = new Date()): string | null {
  const start = new Date(ev.start).getTime()
  if (Number.isNaN(start)) return null
  const updated = ev.updatedAt ? new Date(ev.updatedAt).getTime() : NaN
  const hasUpdated = !Number.isNaN(updated)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goospe//Eventos//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${ev.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${icsEscape(ev.uid)}`,
    `DTSTAMP:${icsDate(now.getTime())}`,
    hasUpdated ? `LAST-MODIFIED:${icsDate(updated)}` : null,
    // Sin fecha de modificación: al menos la cancelación debe "ganar" a la copia ya importada.
    `SEQUENCE:${hasUpdated ? icsSequence(updated) : ev.cancelled ? 1 : 0}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(eventEndMs(ev.start, ev.end))}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : null,
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : null,
    ev.url ? `URL:${ev.url}` : null,
    `STATUS:${ev.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.filter((l): l is string => l !== null).map(icsFold).join('\r\n') + '\r\n'
}

/** Enlace "crear evento" de Google Calendar, o null si la fecha de inicio no es válida. */
export function googleCalendarUrl(ev: CalendarEvent): string | null {
  const start = new Date(ev.start).getTime()
  if (Number.isNaN(start)) return null
  const details = [ev.description, ev.url].filter(Boolean).join('\n\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${icsDate(start)}/${icsDate(eventEndMs(ev.start, ev.end))}`,
  })
  if (details) params.set('details', details)
  if (ev.location) params.set('location', ev.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Nombre de archivo seguro para la cabecera Content-Disposition. */
export function icsFilename(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'evento'}.ics`
}
