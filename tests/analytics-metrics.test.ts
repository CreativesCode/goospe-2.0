import { describe, expect, it } from 'vitest'
import {
  bucketKeys, bucketLabel, buildSeries, dayKeys, isGroup, isRange, kindTotals, metricTotals, niceMax,
  normalizeRows, tickIndexes, todayInZone, type SeriesRow,
} from '@/features/analytics/metrics'

// 2026-10-12 02:30 UTC: en Santiago (UTC-3) todavía es 11 de octubre; en Madrid ya es 12.
const NOW = new Date('2026-10-12T02:30:00Z')

describe('cubetas de tiempo en la zona de la ciudad', () => {
  it('"hoy" depende de la zona horaria', () => {
    expect(todayInZone('America/Santiago', NOW)).toBe('2026-10-11')
    expect(todayInZone('Europe/Madrid', NOW)).toBe('2026-10-12')
    expect(todayInZone('Atlantic/Canary', NOW)).toBe('2026-10-12')
    expect(todayInZone(null, NOW)).toBe('2026-10-12') // sin zona: UTC
    expect(todayInZone('Zona/Inventada', NOW)).toBe('2026-10-12') // zona corrupta: UTC, sin lanzar
  })

  it('dayKeys: N días calendario, del más antiguo a hoy', () => {
    expect(dayKeys(7, 'America/Santiago', NOW)).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ])
    const d90 = dayKeys(90, 'Europe/Madrid', NOW)
    expect(d90).toHaveLength(90)
    expect(d90[0]).toBe('2026-07-15')
    expect(d90[89]).toBe('2026-10-12')
  })

  it('cruza de mes y de año sin saltarse días', () => {
    expect(dayKeys(3, 'UTC', new Date('2027-01-01T12:00:00Z'))).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
    expect(dayKeys(2, 'UTC', new Date('2028-03-01T12:00:00Z'))).toEqual(['2028-02-29', '2028-03-01']) // bisiesto
  })

  it('bucketKeys por agrupación', () => {
    expect(bucketKeys('hour', 30, 'UTC', NOW)).toHaveLength(24)
    expect(bucketKeys('hour', 30, 'UTC', NOW)[7]).toBe('07')
    expect(bucketKeys('dow', 30, 'UTC', NOW)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(bucketKeys('day', 7, 'UTC', NOW)).toHaveLength(7)
  })

  it('etiquetas legibles', () => {
    expect(bucketLabel('day', '2026-10-05')).toBe('5 oct')
    expect(bucketLabel('hour', '07')).toBe('7 h')
    expect(bucketLabel('hour', '23')).toBe('23 h')
    expect(bucketLabel('dow', '0')).toBe('Lun')
    expect(bucketLabel('dow', '6')).toBe('Dom')
  })
})

describe('series y totales', () => {
  const rows: SeriesRow[] = [
    { bucket: '2026-10-10', kind: 'view_detail', n: 4 },
    { bucket: '2026-10-11', kind: 'view_detail', n: 6 },
    { bucket: '2026-10-11', kind: 'view_card', n: 40 },
    { bucket: '2026-10-10', kind: 'call_phone', n: 2 },
    { bucket: '2026-10-10', kind: 'call_whatsapp', n: 3 },
    { bucket: '2026-10-11', kind: 'call_email', n: 1 },
    { bucket: '2026-10-09', kind: 'rsvp', n: 2 },
    { bucket: '2026-10-11', kind: 'review', n: 1 },
    { bucket: '2026-10-11', kind: 'dismiss', n: 99 }, // kind que el panel no muestra
  ]
  const keys = ['2026-10-09', '2026-10-10', '2026-10-11']

  it('buildSeries rellena con 0 y respeta el orden de las cubetas', () => {
    expect(buildSeries(rows, 'view_detail', keys)).toEqual([0, 4, 6])
    expect(buildSeries(rows, 'rsvp', keys)).toEqual([2, 0, 0])
    expect(buildSeries(rows, 'save', keys)).toEqual([0, 0, 0])
  })

  it('"Contactos" suma todos los canales', () => {
    expect(buildSeries(rows, 'call', keys)).toEqual([0, 5, 1])
    expect(metricTotals(rows).call).toBe(6)
    expect(kindTotals(rows)).toMatchObject({ call_phone: 2, call_whatsapp: 3, call_email: 1 })
  })

  it('totales por métrica; lo desconocido no cuenta', () => {
    expect(metricTotals(rows)).toEqual({
      view_detail: 10, view_card: 40, save: 0, directions: 0, share: 0, call: 6, concierge_pick: 0, rsvp: 2, review: 1,
    })
    expect(metricTotals([])).toMatchObject({ view_detail: 0, call: 0 })
  })

  it('la serie de una métrica suma lo mismo que su total', () => {
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
    expect(sum(buildSeries(rows, 'view_detail', keys))).toBe(metricTotals(rows).view_detail)
    expect(sum(buildSeries(rows, 'call', keys))).toBe(metricTotals(rows).call)
  })

  it('una cubeta fuera del rango no entra en la serie', () => {
    expect(buildSeries([{ bucket: '2026-01-01', kind: 'save', n: 5 }], 'save', keys)).toEqual([0, 0, 0])
  })
})

describe('normalizeRows', () => {
  it('convierte bigint en texto y descarta filas raras', () => {
    expect(normalizeRows([
      { bucket: '07', kind: 'save', n: '12' },
      { bucket: '08', kind: 'save', n: 3 },
      { bucket: 9, kind: 'save', n: 1 },
      { bucket: '10', kind: 'save', n: 'x' },
      null,
    ])).toEqual([{ bucket: '07', kind: 'save', n: 12 }, { bucket: '08', kind: 'save', n: 3 }])
    expect(normalizeRows(null)).toEqual([])
    expect(normalizeRows({})).toEqual([])
  })
})

describe('ejes del gráfico', () => {
  it('niceMax redondea hacia arriba a 1, 2, 5 × 10ⁿ', () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(3)).toBe(4)
    expect(niceMax(5)).toBe(5)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(12)).toBe(20)
    expect(niceMax(40)).toBe(50)
    expect(niceMax(51)).toBe(100)
    expect(niceMax(1234)).toBe(2000)
  })

  it('tickIndexes: todas si caben; si no, repartidas y con la última', () => {
    expect(tickIndexes(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    const t = tickIndexes(90, 6)
    expect(t.length).toBeLessThanOrEqual(6)
    expect(t[t.length - 1]).toBe(89)
    expect(t).toEqual([...t].sort((a, b) => a - b))
    expect(tickIndexes(24, 6).at(-1)).toBe(23)
  })

  it('validadores de rango y agrupación', () => {
    expect(isRange(30)).toBe(true)
    expect(isRange(31)).toBe(false)
    expect(isGroup('hour')).toBe(true)
    expect(isGroup('month')).toBe(false)
  })
})
