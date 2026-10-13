import { describe, expect, it } from 'vitest'
import { buildIcs, eventEndMs, googleCalendarUrl, icsDate, icsEscape, icsFilename, icsFold } from '@/lib/ics'

const base = {
  uid: 'abc@goospe',
  title: 'Cata de vinos',
  start: '2026-07-17T20:00:00Z',
}
const now = new Date('2026-07-01T12:00:00Z')

describe('icsDate / eventEndMs', () => {
  it('formatea en UTC sin separadores ni milisegundos', () => {
    expect(icsDate(Date.UTC(2026, 6, 17, 20, 5, 9))).toBe('20260717T200509Z')
  })

  it('sin fin (o con un fin anterior al inicio) dura 3 h', () => {
    const start = new Date(base.start).getTime()
    expect(eventEndMs(base.start, null)).toBe(start + 3 * 3600_000)
    expect(eventEndMs(base.start, '2026-07-17T19:00:00Z')).toBe(start + 3 * 3600_000)
    expect(eventEndMs(base.start, '2026-07-17T21:00:00Z')).toBe(start + 3600_000)
  })
})

describe('icsEscape / icsFold', () => {
  it('escapa barra invertida, coma, punto y coma y saltos de línea', () => {
    expect(icsEscape('a\\b; c, d\ne\r\nf')).toBe('a\\\\b\\; c\\, d\\ne\\nf')
  })

  it('pliega a 75 octetos sin partir caracteres multibyte', () => {
    const line = `SUMMARY:${'ñ'.repeat(100)}`
    const folded = icsFold(line)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const [i, part] of parts.entries()) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
      if (i > 0) expect(part.startsWith(' ')).toBe(true)
    }
    // Al desplegar (quitar CRLF + espacio) se recupera la línea original.
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('no toca una línea corta', () => {
    expect(icsFold('SUMMARY:Hola')).toBe('SUMMARY:Hola')
  })
})

describe('buildIcs', () => {
  it('genera un VEVENT válido con CRLF', () => {
    const ics = buildIcs({ ...base, end: '2026-07-17T22:00:00Z', location: 'Bar Nina, Calle 1', url: 'https://goospe.com/events/abc', description: 'Trae a un amigo; hay cupos' }, now)
    expect(ics).not.toBeNull()
    const lines = ics!.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('METHOD:PUBLISH')
    expect(lines).toContain('UID:abc@goospe')
    expect(lines).toContain('DTSTAMP:20260701T120000Z')
    expect(lines).toContain('DTSTART:20260717T200000Z')
    expect(lines).toContain('DTEND:20260717T220000Z')
    expect(lines).toContain('SUMMARY:Cata de vinos')
    expect(lines).toContain('DESCRIPTION:Trae a un amigo\\; hay cupos')
    expect(lines).toContain('LOCATION:Bar Nina\\, Calle 1')
    expect(lines).toContain('URL:https://goospe.com/events/abc')
    expect(lines).toContain('STATUS:CONFIRMED')
    expect(ics!.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/) // ningún salto de línea suelto
  })

  it('omite los campos vacíos y usa 3 h si no hay fin', () => {
    const ics = buildIcs(base, now)!
    expect(ics).toContain('DTEND:20260717T230000Z')
    expect(ics).not.toContain('DESCRIPTION')
    expect(ics).not.toContain('LOCATION')
    expect(ics).not.toContain('URL:')
  })

  it('un evento cancelado sale como cancelación', () => {
    const ics = buildIcs({ ...base, cancelled: true }, now)!
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
  })

  it('fecha inválida → null', () => {
    expect(buildIcs({ ...base, start: 'mañana' }, now)).toBeNull()
  })
})

describe('googleCalendarUrl', () => {
  it('arma el enlace con fechas en UTC y texto codificado', () => {
    const url = new URL(googleCalendarUrl({ ...base, location: 'Bar Nina', description: 'Vinos & quesos', url: 'https://goospe.com/events/abc' })!)
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Cata de vinos')
    expect(url.searchParams.get('dates')).toBe('20260717T200000Z/20260717T230000Z')
    expect(url.searchParams.get('location')).toBe('Bar Nina')
    expect(url.searchParams.get('details')).toBe('Vinos & quesos\n\nhttps://goospe.com/events/abc')
  })

  it('fecha inválida → null', () => {
    expect(googleCalendarUrl({ ...base, start: '' })).toBeNull()
  })
})

describe('icsFilename', () => {
  it('quita tildes y símbolos', () => {
    expect(icsFilename('¡Tapas de carne para compartir!')).toBe('tapas-de-carne-para-compartir.ics')
    expect(icsFilename('Peña "Ñandú" / 2026')).toBe('pena-nandu-2026.ics')
    expect(icsFilename('🎉')).toBe('evento.ics')
  })
})

describe('SEQUENCE y LAST-MODIFIED', () => {
  const base = { uid: 'e1@goospe', title: 'Concierto', start: '2026-11-01T22:00:00Z' }
  const now = new Date('2026-10-12T12:00:00Z')
  const field = (ics: string | null, name: string) => ics?.split('\r\n').find((l) => l.startsWith(`${name}:`)) ?? null

  it('con fecha de modificación lleva ambos', () => {
    const ics = buildIcs({ ...base, updatedAt: '2026-10-10T08:30:00Z' }, now)
    expect(field(ics, 'LAST-MODIFIED')).toBe('LAST-MODIFIED:20261010T083000Z')
    expect(field(ics, 'SEQUENCE')).toMatch(/^SEQUENCE:\d+$/)
  })
  it('SEQUENCE crece con cada modificación y cabe en 32 bits', () => {
    const seq = (iso: string) => Number(field(buildIcs({ ...base, updatedAt: iso }, now), 'SEQUENCE')!.split(':')[1])
    expect(seq('2026-10-10T08:30:01Z')).toBeGreaterThan(seq('2026-10-10T08:30:00Z'))
    expect(seq('2080-01-01T00:00:00Z')).toBeLessThan(2 ** 31)
    expect(seq('2019-01-01T00:00:00Z')).toBe(0)
  })
  it('sin fecha de modificación: 0, y 1 al cancelar (la cancelación gana a la copia importada)', () => {
    expect(field(buildIcs(base, now), 'SEQUENCE')).toBe('SEQUENCE:0')
    expect(field(buildIcs({ ...base, cancelled: true }, now), 'SEQUENCE')).toBe('SEQUENCE:1')
    expect(field(buildIcs(base, now), 'LAST-MODIFIED')).toBeNull()
  })
  it('una fecha de modificación inválida se ignora', () => {
    expect(field(buildIcs({ ...base, updatedAt: 'ayer' }, now), 'LAST-MODIFIED')).toBeNull()
  })
})
