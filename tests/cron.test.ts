import { describe, expect, it } from 'vitest'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { activityTotal, isWeeklyRunDay, lastClosedWeek, periodLabel, weeklyEmailKey } from '@/lib/reports/week'

const SECRET = 'cron-secret-de-prueba-0123456789'

describe('isAuthorizedCron', () => {
  it('acepta solo el secreto exacto', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true)
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false)
    expect(isAuthorizedCron(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false)
    expect(isAuthorizedCron(`bearer ${SECRET}`, SECRET)).toBe(false)
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(false)
    expect(isAuthorizedCron('Bearer ', SECRET)).toBe(false)
    expect(isAuthorizedCron(null, SECRET)).toBe(false)
  })

  it('falla cerrado sin secreto configurado', () => {
    expect(isAuthorizedCron('Bearer ', '')).toBe(false)
    expect(isAuthorizedCron('Bearer undefined', undefined)).toBe(false)
    expect(isAuthorizedCron('Bearer null', null)).toBe(false)
    expect(isAuthorizedCron('Bearer    ', '   ')).toBe(false)
  })

  it('un secreto corto cuenta como ausente', () => {
    expect(isAuthorizedCron('Bearer abc', 'abc')).toBe(false)
  })
})

describe('semana del informe', () => {
  // Lunes 12-oct-2026 11:30 UTC = 08:30 en Santiago (UTC-3 en horario de verano).
  const monday = new Date('2026-10-12T11:30:00Z')

  it('el lunes cubre la semana anterior completa, de lunes a domingo, en la zona de la ciudad', () => {
    const w = lastClosedWeek(monday, 'America/Santiago')
    expect(w).toMatchObject({ start: '2026-10-05', end: '2026-10-11', weekday: 1 })
    expect(w.fromIso).toBe('2026-10-05T03:00:00.000Z')
    expect(w.toIso).toBe('2026-10-12T03:00:00.000Z')
  })

  it('la clave no cambia durante la semana: un reintento el martes o el miércoles es la misma semana', () => {
    const keys = ['2026-10-12T11:00:00Z', '2026-10-13T11:59:00Z', '2026-10-14T23:00:00Z', '2026-10-18T20:00:00Z']
      .map((t) => lastClosedWeek(new Date(t), 'America/Santiago').start)
    expect(new Set(keys)).toEqual(new Set(['2026-10-05']))
    expect(lastClosedWeek(new Date('2026-10-19T11:00:00Z'), 'America/Santiago').start).toBe('2026-10-12')
  })

  it('el día es el LOCAL: domingo por la noche en Chile aunque en UTC ya sea lunes', () => {
    const w = lastClosedWeek(new Date('2026-10-12T02:00:00Z'), 'America/Santiago') // domingo 23:00 en Santiago
    expect(w.weekday).toBe(7)
    expect(w.start).toBe('2026-09-28')
    expect(lastClosedWeek(new Date('2026-10-12T02:00:00Z'), 'Europe/Madrid').weekday).toBe(1)
  })

  it('sin zona usa UTC y cruza bien el cambio de año', () => {
    const w = lastClosedWeek(new Date('2027-01-04T11:00:00Z'), null)
    expect(w).toMatchObject({ start: '2026-12-28', end: '2027-01-03', weekday: 1 })
    expect(w.fromIso).toBe('2026-12-28T00:00:00.000Z')
  })

  it('solo corre lunes (envío) y martes/miércoles (pendientes)', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(isWeeklyRunDay)).toEqual([true, true, true, false, false, false, false])
  })

  it('claves de idempotencia: estables y distintas por negocio, semana y destinatario', () => {
    expect(weeklyEmailKey('b1', '2026-10-05', 'u1')).toBe('weekly:b1:2026-10-05:u1')
    expect(weeklyEmailKey('b1', '2026-10-05', 'u1')).not.toBe(weeklyEmailKey('b1', '2026-10-12', 'u1'))
    expect(weeklyEmailKey('b1', '2026-10-05', 'u1')).not.toBe(weeklyEmailKey('b1', '2026-10-05', 'u2'))
    expect(weeklyEmailKey('b1', '2026-10-05', 'u1')).not.toBe(weeklyEmailKey('b2', '2026-10-05', 'u1'))
  })

  it('periodLabel', () => {
    expect(periodLabel('2026-10-05', '2026-10-11')).toBe('5 al 11 de octubre')
    expect(periodLabel('2026-09-28', '2026-10-04')).toBe('28 de septiembre al 4 de octubre')
  })

  it('activityTotal: sin actividad no hay informe; descartes y des-guardados no cuentan', () => {
    expect(activityTotal({}, 0)).toBe(0)
    expect(activityTotal({ dismiss: 5, unsave: 2 }, 0)).toBe(0)
    expect(activityTotal({ view_card: 10, save: 1, dismiss: 5 }, 0)).toBe(11)
    expect(activityTotal({}, 1)).toBe(1)
  })
})
