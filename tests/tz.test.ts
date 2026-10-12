import { afterEach, describe, expect, it, vi } from 'vitest'
import { fmtInZone, nowLocalInZone, zonedTimeToUtc, zoneNowParts } from '@/lib/tz'

const iso = (d: Date | null) => d?.toISOString() ?? null

describe('zonedTimeToUtc', () => {
  it('interpreta la hora de pared en la zona de la ciudad, no en la del servidor', () => {
    expect(iso(zonedTimeToUtc('2026-07-15T20:00', 'America/Santiago'))).toBe('2026-07-16T00:00:00.000Z')
    expect(iso(zonedTimeToUtc('2026-01-15T20:00', 'America/Santiago'))).toBe('2026-01-15T23:00:00.000Z')
    expect(iso(zonedTimeToUtc('2026-07-15T20:00', 'Europe/Madrid'))).toBe('2026-07-15T18:00:00.000Z')
    expect(iso(zonedTimeToUtc('2026-01-15T20:00', 'Europe/Madrid'))).toBe('2026-01-15T19:00:00.000Z')
    expect(iso(zonedTimeToUtc('2026-07-15T20:00', 'Atlantic/Canary'))).toBe('2026-07-15T19:00:00.000Z')
  })

  it('acepta segundos', () => {
    expect(iso(zonedTimeToUtc('2026-07-15T20:00:30', 'Europe/Madrid'))).toBe('2026-07-15T18:00:30.000Z')
  })

  it('sin zona o con zona corrupta usa UTC', () => {
    expect(iso(zonedTimeToUtc('2026-07-15T20:00', null))).toBe('2026-07-15T20:00:00.000Z')
    expect(iso(zonedTimeToUtc('2026-07-15T20:00', 'Marte/Olympus'))).toBe('2026-07-15T20:00:00.000Z')
  })

  it('valor mal formado devuelve null', () => {
    expect(zonedTimeToUtc('', 'Europe/Madrid')).toBeNull()
    expect(zonedTimeToUtc('15/07/2026 20:00', 'Europe/Madrid')).toBeNull()
    expect(zonedTimeToUtc('2026-07-15', 'Europe/Madrid')).toBeNull()
  })

  it('es la inversa de fmtInZone', () => {
    const d = zonedTimeToUtc('2026-03-08T09:45', 'America/Santiago')
    expect(d).not.toBeNull()
    expect(fmtInZone(d!.toISOString(), 'America/Santiago', { hour: '2-digit', minute: '2-digit' })).toBe('09:45')
  })
})

describe('fmtInZone', () => {
  it('formatea en la zona pedida con reloj de 24 h', () => {
    const opts = { hour: '2-digit', minute: '2-digit' } as const
    expect(fmtInZone('2026-07-16T00:00:00Z', 'America/Santiago', opts)).toBe('20:00')
    expect(fmtInZone('2026-07-16T00:00:00Z', 'Europe/Madrid', opts)).toBe('02:00')
    expect(fmtInZone('2026-07-16T04:05:00Z', 'America/Santiago', opts)).toBe('00:05') // nunca "24:05"
  })

  it('fecha inválida devuelve cadena vacía', () => {
    expect(fmtInZone('no es fecha', 'America/Santiago', { hour: '2-digit' })).toBe('')
  })

  it('una zona corrupta no lanza', () => {
    expect(() => fmtInZone('2026-07-16T00:00:00Z', 'Marte/Olympus', { hour: '2-digit' })).not.toThrow()
  })
})

describe('ahora en la zona', () => {
  afterEach(() => vi.useRealTimers())

  it('nowLocalInZone devuelve formato datetime-local en la zona', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T02:30:00Z'))
    expect(nowLocalInZone('America/Santiago')).toBe('2026-07-14T22:30')
    expect(nowLocalInZone('Europe/Madrid')).toBe('2026-07-15T04:30')
    expect(nowLocalInZone(null)).toBe('2026-07-15T02:30')
  })

  it('zoneNowParts: medianoche es minuto 0, no 1440', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T04:00:00Z')) // 00:00 del miércoles en Santiago
    expect(zoneNowParts('America/Santiago')).toEqual({ osmDay: 2, minutes: 0 })
  })

  it('zoneNowParts: el domingo es 6', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T15:00:00Z'))
    expect(zoneNowParts('Europe/Madrid')).toEqual({ osmDay: 6, minutes: 17 * 60 })
  })
})
