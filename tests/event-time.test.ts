import { describe, expect, it } from 'vitest'
import {
  addDays, endOfWeek, eventPhase, inEventWindow, isEventOver, localDay, parseEventWindow,
} from '@/features/events/event-time'

const at = (iso: string) => new Date(iso).getTime()
const SCL = 'America/Santiago' // UTC-3 en verano (enero), UTC-4 en invierno (julio)
const MAD = 'Europe/Madrid' // UTC+2 en verano (julio)

describe('parseEventWindow', () => {
  it('acepta solo las tres pestañas; lo demás es "proximos"', () => {
    expect(parseEventWindow('hoy')).toBe('hoy')
    expect(parseEventWindow('semana')).toBe('semana')
    expect(parseEventWindow('proximos')).toBe('proximos')
    expect(parseEventWindow('HOY')).toBe('proximos')
    expect(parseEventWindow(undefined)).toBe('proximos')
    expect(parseEventWindow(['hoy'])).toBe('proximos')
  })
})

describe('localDay / addDays / endOfWeek', () => {
  it('el día civil depende de la zona de la ciudad, no de UTC', () => {
    // 02:30 UTC del 16 de julio: en Santiago aún es 15 (22:30), en Madrid ya es 16 (04:30).
    expect(localDay('2026-07-16T02:30:00Z', SCL)).toBe('2026-07-15')
    expect(localDay('2026-07-16T02:30:00Z', MAD)).toBe('2026-07-16')
    expect(localDay(at('2026-07-16T02:30:00Z'), SCL)).toBe('2026-07-15')
  })

  it('sin zona usa UTC', () => {
    expect(localDay('2026-07-16T02:30:00Z', null)).toBe('2026-07-16')
  })

  it('addDays cruza mes y año', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('la semana va de lunes a domingo', () => {
    expect(endOfWeek('2026-10-12')).toBe('2026-10-18') // lunes
    expect(endOfWeek('2026-10-15')).toBe('2026-10-18') // jueves
    expect(endOfWeek('2026-10-18')).toBe('2026-10-18') // domingo: termina hoy
  })
})

describe('isEventOver / eventPhase', () => {
  const ev = { starts_at: '2026-07-15T20:00:00Z', ends_at: null, status: 'approved' }

  it('sin hora de fin, termina 3 h después de empezar', () => {
    expect(isEventOver(ev, at('2026-07-15T22:59:00Z'))).toBe(false)
    expect(isEventOver(ev, at('2026-07-15T23:01:00Z'))).toBe(true)
  })

  it('con hora de fin manda la hora de fin', () => {
    const long = { ...ev, ends_at: '2026-07-16T04:00:00Z' }
    expect(isEventOver(long, at('2026-07-16T03:00:00Z'))).toBe(false)
    expect(isEventOver(long, at('2026-07-16T04:01:00Z'))).toBe(true)
  })

  it('fases', () => {
    expect(eventPhase(ev, at('2026-07-15T19:00:00Z'))).toBe('upcoming')
    expect(eventPhase(ev, at('2026-07-15T21:00:00Z'))).toBe('live')
    expect(eventPhase(ev, at('2026-07-16T12:00:00Z'))).toBe('past')
    expect(eventPhase({ ...ev, status: 'cancelled' }, at('2026-07-15T19:00:00Z'))).toBe('cancelled')
  })
})

describe('inEventWindow', () => {
  // Jueves 15 de octubre de 2026, 15:00 en Santiago (UTC-3) = 18:00 UTC.
  const now = at('2026-10-15T18:00:00Z')
  const starts = (iso: string) => ({ starts_at: iso, ends_at: null })

  it('hoy: el día se corta a medianoche de la ciudad, no de UTC', () => {
    // 23:30 del jueves en Santiago = 02:30 UTC del viernes → sigue siendo "hoy".
    expect(inEventWindow(starts('2026-10-16T02:30:00Z'), 'hoy', SCL, now)).toBe(true)
    // 00:30 del viernes en Santiago = 03:30 UTC → ya no es hoy.
    expect(inEventWindow(starts('2026-10-16T03:30:00Z'), 'hoy', SCL, now)).toBe(false)
  })

  it('la misma hora cae en días distintos según la ciudad', () => {
    // 23:00 UTC del jueves: en Madrid (UTC+2) ya es viernes 01:00.
    const ev = starts('2026-10-15T23:00:00Z')
    expect(inEventWindow(ev, 'hoy', SCL, now)).toBe(true)
    expect(inEventWindow(ev, 'hoy', MAD, now)).toBe(false)
  })

  it('hoy incluye un evento en curso y excluye uno terminado', () => {
    expect(inEventWindow(starts('2026-10-15T16:00:00Z'), 'hoy', SCL, now)).toBe(true) // empezó hace 2 h
    expect(inEventWindow(starts('2026-10-15T14:00:00Z'), 'hoy', SCL, now)).toBe(false) // terminó hace 1 h
  })

  it('semana: hasta el domingo de la ciudad, inclusive', () => {
    // Domingo 18 a las 23:00 en Santiago = lunes 19 a las 02:00 UTC.
    expect(inEventWindow(starts('2026-10-19T02:00:00Z'), 'semana', SCL, now)).toBe(true)
    // Lunes 19 a las 00:30 en Santiago.
    expect(inEventWindow(starts('2026-10-19T03:30:00Z'), 'semana', SCL, now)).toBe(false)
    expect(inEventWindow(starts('2026-10-16T02:30:00Z'), 'semana', SCL, now)).toBe(true)
  })

  it('proximos: todo lo que no ha terminado', () => {
    expect(inEventWindow(starts('2027-03-01T20:00:00Z'), 'proximos', SCL, now)).toBe(true)
    expect(inEventWindow(starts('2026-10-14T20:00:00Z'), 'proximos', SCL, now)).toBe(false)
  })

  it('una fecha inválida no entra en ninguna ventana', () => {
    expect(inEventWindow(starts('no-es-fecha'), 'proximos', SCL, now)).toBe(false)
  })
})
