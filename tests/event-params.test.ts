import { describe, expect, it } from 'vitest'
import { ALL_CITIES, eventsHref, eventsParamsSchema, parseEventsParams } from '@/features/events/event-params'

describe('parámetros de la cartelera', () => {
  it('sin parámetros no falla: "Próximos" y sin ciudad (antes lanzaba "expected nonoptional")', () => {
    expect(() => eventsParamsSchema.parse({})).not.toThrow()
    expect(eventsParamsSchema.parse({})).toEqual({ when: 'proximos', city: null })
    expect(parseEventsParams({})).toEqual({ when: 'proximos', city: null })
  })
  it('cada clave es opcional por separado', () => {
    expect(eventsParamsSchema.parse({ when: 'hoy' })).toEqual({ when: 'hoy', city: null })
    expect(eventsParamsSchema.parse({ city: 'puerto-varas' })).toEqual({ when: 'proximos', city: 'puerto-varas' })
    expect(eventsParamsSchema.parse({ when: undefined, city: undefined })).toEqual({ when: 'proximos', city: null })
  })
  it('lee los dos a la vez', () => {
    expect(parseEventsParams({ when: 'semana', city: 'granada-es' })).toEqual({ when: 'semana', city: 'granada-es' })
  })
  it('"todas" pide todas las ciudades de forma explícita', () => {
    expect(parseEventsParams({ city: ALL_CITIES }).city).toBe('todas')
  })
  it('valores repetidos (?when=a&when=b): cuenta el primero', () => {
    expect(parseEventsParams({ when: ['hoy', 'semana'], city: ['granada-es', 'x'] })).toEqual({ when: 'hoy', city: 'granada-es' })
    expect(parseEventsParams({ when: [], city: [] })).toEqual({ when: 'proximos', city: null })
  })
  it('valores inválidos caen al valor por defecto en vez de fallar', () => {
    expect(parseEventsParams({ when: 'ayer', city: 'Granada ES!' })).toEqual({ when: 'proximos', city: null })
    expect(parseEventsParams({ when: '', city: '' })).toEqual({ when: 'proximos', city: null })
    expect(parseEventsParams({ when: 5, city: { a: 1 } })).toEqual({ when: 'proximos', city: null })
    expect(parseEventsParams({ city: 'a'.repeat(200) }).city).toBeNull()
  })
  it('ignora claves desconocidas y entradas que no son un objeto', () => {
    expect(parseEventsParams({ utm_source: 'x', page: '3', when: 'hoy' })).toEqual({ when: 'hoy', city: null })
    for (const raw of [null, undefined, 'when=hoy', 7, []]) {
      expect(parseEventsParams(raw)).toEqual({ when: 'proximos', city: null })
    }
  })
})

describe('eventsHref', () => {
  it('no escribe los valores por defecto', () => {
    expect(eventsHref('proximos', null)).toBe('/events')
    expect(eventsHref('hoy', null)).toBe('/events?when=hoy')
    expect(eventsHref('proximos', 'puerto-varas')).toBe('/events?city=puerto-varas')
    expect(eventsHref('semana', ALL_CITIES)).toBe('/events?when=semana&city=todas')
  })
  it('ida y vuelta con el parser', () => {
    const url = new URL(eventsHref('semana', 'granada-es'), 'https://goospe.com')
    expect(parseEventsParams(Object.fromEntries(url.searchParams))).toEqual({ when: 'semana', city: 'granada-es' })
  })
})
