import { describe, expect, it } from 'vitest'
import {
  MIN_BASE, addDays, cohortRetention, decisionRate, fillWeeks, fmtRate, fmtWeek, overallRetention,
  pointsDelta, rate, stickiness, todayIn, weekStart,
  type CohortRow, type WeeklyRow,
} from '@/features/admin/product-metrics'

describe('rate', () => {
  it('porcentaje con un decimal', () => {
    expect(rate(1, 3, 1)).toEqual({ pct: 33.3, n: 1, base: 3, low: false })
    expect(rate(50, 200).pct).toBe(25)
  })
  it('base 0 → sin porcentaje (todavía no se puede medir), no 0 %', () => {
    expect(rate(0, 0)).toEqual({ pct: null, n: 0, base: 0, low: true })
    expect(fmtRate(rate(0, 0))).toBe('—')
  })
  it('marca la base pequeña', () => {
    expect(rate(2, MIN_BASE - 1).low).toBe(true)
    expect(rate(2, MIN_BASE).low).toBe(false)
  })
  it('nunca pasa de 100 % ni acepta basura', () => {
    expect(rate(12, 10).pct).toBe(100)
    expect(rate('7', '14', 1).pct).toBe(50) // la API puede devolver bigint como texto
    expect(rate(null, undefined).pct).toBeNull()
    expect(rate(-3, 10).pct).toBe(0)
  })
})

describe('fechas', () => {
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-10-12', -7)).toBe('2026-10-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('weekStart: lunes de la semana (el domingo pertenece a la semana que termina)', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12') // lunes
    expect(weekStart('2026-10-14')).toBe('2026-10-12') // miércoles
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // domingo
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
  })
  it('todayIn usa la zona de reporte, no UTC', () => {
    const lateUtc = new Date('2026-10-13T02:30:00Z') // 12-oct 23:30 en Santiago (UTC−3)
    expect(todayIn('America/Santiago', lateUtc)).toBe('2026-10-12')
    expect(todayIn('Europe/Madrid', lateUtc)).toBe('2026-10-13')
    expect(todayIn('Zona/Inexistente', lateUtc)).toBe('2026-10-13') // respaldo: UTC
  })
  it('fmtWeek', () => {
    expect(fmtWeek('2026-10-12')).toBe('12 oct')
  })
})

const week = (w: string, p: Partial<WeeklyRow> = {}): WeeklyRow => ({
  week: w, actors: 0, signed_in: 0, anonymous: 0, visits: 0, deciders: 0, decided_visits: 0, decisions: 0, ...p,
})

describe('fillWeeks', () => {
  it('de la semana en curso hacia atrás, con ceros donde no hubo actividad', () => {
    const rows = [week('2026-10-12', { actors: 16, visits: 20 }), week('2026-09-28', { actors: 3 })]
    const out = fillWeeks(rows, 4, '2026-10-14')
    expect(out.map((w) => w.week)).toEqual(['2026-10-12', '2026-10-05', '2026-09-28', '2026-09-21'])
    expect(out.map((w) => w.actors)).toEqual([16, 0, 3, 0])
    expect(out[1].visits).toBe(0)
  })
  it('acepta fechas con hora y números como texto', () => {
    const rows = [{ ...week('2026-10-12T00:00:00+00:00'), actors: '5' as unknown as number }]
    expect(fillWeeks(rows, 1, '2026-10-12')[0].actors).toBe(5)
  })
  it('ignora semanas fuera de la ventana', () => {
    expect(fillWeeks([week('2026-01-05', { actors: 9 })], 2, '2026-10-14').every((w) => w.actors === 0)).toBe(true)
  })
})

describe('métrica norte', () => {
  it('% de visitas con al menos una decisión', () => {
    expect(decisionRate({ visits: 40, decided_visits: 10 }).pct).toBe(25)
    expect(decisionRate({ visits: 0, decided_visits: 0 }).pct).toBeNull()
  })
  it('variación en puntos porcentuales', () => {
    expect(pointsDelta(rate(30, 100), rate(25, 100))).toBe(5)
    expect(pointsDelta(rate(10, 100), rate(25, 100))).toBe(-15)
    expect(pointsDelta(rate(1, 0), rate(25, 100))).toBeNull()
  })
  it('stickiness DAU/MAU', () => {
    expect(stickiness({ dau: 5, mau: 50 }).pct).toBe(10)
    expect(stickiness({ dau: 0, mau: 0 }).pct).toBeNull()
  })
})

const cohort = (p: Partial<CohortRow>): CohortRow => ({
  cohort_week: '2026-09-07', actors: 0, signed_in: 0,
  d1_eligible: 0, d1: 0, d7_eligible: 0, d7: 0, d30_eligible: 0, d30: 0, ...p,
})

describe('retención', () => {
  it('usa como base a quienes ya pudieron volver, no a toda la cohorte', () => {
    const c = cohortRetention(cohort({ actors: 40, signed_in: 6, d1_eligible: 40, d1: 10, d7_eligible: 30, d7: 6, d30_eligible: 0, d30: 0 }))
    expect(c.actors).toBe(40)
    expect(c.signedIn).toBe(6)
    expect(c.d1.pct).toBe(25)
    expect(c.d7).toMatchObject({ pct: 20, n: 6, base: 30 })
    expect(c.d30.pct).toBeNull() // la cohorte aún no cumple 30 días: "—", no 0 %
  })
  it('cohorte pequeña: porcentaje marcado como poco fiable', () => {
    expect(cohortRetention(cohort({ actors: 3, d1_eligible: 3, d1: 1 })).d1).toMatchObject({ pct: 33.3, low: true })
  })
  it('global = suma de retenidos / suma de elegibles (no el promedio de porcentajes)', () => {
    const rows = [
      cohort({ d1_eligible: 2, d1: 2, d7_eligible: 2, d7: 1 }),      // 100 % con 2 personas
      cohort({ d1_eligible: 198, d1: 18, d7_eligible: 98, d7: 9 }),  // 9,1 % con 198
    ]
    const o = overallRetention(rows)
    expect(o.d1).toMatchObject({ pct: 10, n: 20, base: 200 })
    expect(o.d7).toMatchObject({ pct: 10, n: 10, base: 100 })
    expect(o.d30.pct).toBeNull()
  })
  it('sin cohortes', () => {
    expect(overallRetention([]).d1.pct).toBeNull()
  })
})
