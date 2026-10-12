import { describe, expect, it } from 'vitest'
import { humanizeHours, isOpenNow } from '@/lib/hours'
import {
  emptyWeek, hoursInputSchema, osmToHoursInput, parseHoursField, toStoredHours, validateWeek, weekToOsm,
  type DaySchedule, type WeekSchedule,
} from '@/lib/hours-editor'

const [MO, TU, , , FR, SA, SU] = [0, 1, 2, 3, 4, 5, 6]
const at = (h: number, m = 0) => h * 60 + m
const open = (...ranges: [string, string][]): DaySchedule => ({ closed: false, ranges: ranges.map(([from, to]) => ({ from, to })) })
const closed: DaySchedule = { closed: true, ranges: [] }
const week = (fill: (i: number) => DaySchedule): WeekSchedule => Array.from({ length: 7 }, (_, i) => fill(i))

describe('weekToOsm', () => {
  it('mismo horario todos los días', () => {
    expect(weekToOsm(week(() => open(['09:00', '18:00'])))).toBe('Mo-Su 09:00-18:00')
  })

  it('agrupa días iguales y pone los cerrados primero', () => {
    const w = week((i) => (i <= FR ? open(['09:00', '18:00']) : i === SA ? open(['10:00', '14:00']) : closed))
    expect(weekToOsm(w)).toBe('Su off; Mo-Fr 09:00-18:00; Sa 10:00-14:00')
  })

  it('días no consecutivos y varios tramos ordenados', () => {
    const w = week((i) => (i === MO || i === 2 || i === FR ? open(['15:00', '19:00'], ['09:00', '13:00']) : closed))
    expect(weekToOsm(w)).toBe('Tu,Th,Sa,Su off; Mo,We,Fr 09:00-13:00,15:00-19:00')
  })

  it('dos días seguidos van con coma; tres o más, como rango', () => {
    expect(weekToOsm(week((i) => (i <= TU ? open(['08:00', '12:00']) : closed)))).toBe('We-Su off; Mo,Tu 08:00-12:00')
  })
})

describe('compatibilidad con isOpenNow / humanizeHours', () => {
  const w = week((i) => (i <= FR ? open(['09:00', '13:00'], ['15:00', '19:00']) : i === SA ? open(['20:00', '02:00']) : closed))
  const raw = weekToOsm(w)

  it('isOpenNow entiende lo que genera el editor', () => {
    expect(isOpenNow(raw, MO, at(10))).toBe(true)
    expect(isOpenNow(raw, MO, at(14))).toBe(false) // entre tramos
    expect(isOpenNow(raw, MO, at(18, 59))).toBe(true)
    expect(isOpenNow(raw, SA, at(21))).toBe(true)
    expect(isOpenNow(raw, SA, at(12))).toBe(false)
    expect(isOpenNow(raw, SU, at(12))).toBe(false)
  })

  it('un tramo nocturno sigue abierto la madrugada del día cerrado', () => {
    expect(isOpenNow(raw, SU, at(1))).toBe(true) // noche del sábado
    expect(isOpenNow(raw, SU, at(2))).toBe(false)
  })

  it('humanizeHours lo muestra en español, con el lunes primero', () => {
    // El editor guarda el día cerrado delante ("Su off; …"); al mostrar va en su sitio.
    expect(humanizeHours(raw)).toEqual([
      'Lun a Vie: 09:00–13:00 y 15:00–19:00',
      'Sáb: 20:00–02:00',
      'Dom: Cerrado',
    ])
  })

  it('ida y vuelta: OSM -> editor -> OSM', () => {
    const parsed = osmToHoursInput(raw)
    expect(parsed?.mode).toBe('custom')
    expect(weekToOsm(parsed!.days)).toBe(raw)
  })
})

describe('osmToHoursInput', () => {
  it('sin dato y 24/7', () => {
    expect(osmToHoursInput(null)).toEqual({ mode: 'unset', days: emptyWeek() })
    expect(osmToHoursInput('  ')?.mode).toBe('unset')
    expect(osmToHoursInput('24/7')?.mode).toBe('always')
  })

  it('formatos reales de OSM', () => {
    const a = osmToHoursInput('Mo-Fr 08:00-20:30; Sa 09:00-20:30')!
    expect(a.days[MO]).toEqual(open(['08:00', '20:30']))
    expect(a.days[SA]).toEqual(open(['09:00', '20:30']))
    expect(a.days[SU]).toEqual(closed) // no mencionado = cerrado

    const b = osmToHoursInput('09:00-21:00')!
    expect(b.days.every((d) => !d.closed && d.ranges[0].from === '09:00')).toBe(true)

    const c = osmToHoursInput('Mo-Fr 07:00-24:00, Sa,Su 8:00-24:00')!
    expect(c.days[FR]).toEqual(open(['07:00', '00:00'])) // 24:00 se muestra como medianoche
    expect(c.days[SU]).toEqual(open(['08:00', '00:00']))

    const d = osmToHoursInput('Mo-Su 09:00-18:00; Tu off')!
    expect(d.days[TU]).toEqual(closed)
    expect(d.days[MO]).toEqual(open(['09:00', '18:00']))
  })

  it('lo que no sabe representar devuelve null (no se pisa en silencio)', () => {
    expect(osmToHoursInput('"abre en verano"')).toBeNull()
    expect(osmToHoursInput('Mo-Fr 09:00-18:00; PH off')).toBeNull()
    expect(osmToHoursInput('Dec 24 09:00-13:00')).toBeNull()
    expect(osmToHoursInput('sunrise-sunset')).toBeNull()
    expect(osmToHoursInput('Mo 09:00-18:00+')).toBeNull()
  })
})

describe('validateWeek', () => {
  it('semana válida', () => {
    expect(validateWeek(week(() => open(['09:00', '13:00'], ['15:00', '19:00'])))).toBeNull()
    expect(validateWeek(emptyWeek())).toBeNull()
    expect(validateWeek(week(() => open(['20:00', '02:00'])))).toBeNull() // cruza medianoche
  })

  it('detecta problemas con el nombre del día', () => {
    expect(validateWeek(week((i) => (i === MO ? { closed: false, ranges: [] } : closed)))).toMatch(/^Lunes: agrega un tramo/)
    expect(validateWeek(week((i) => (i === TU ? open(['09:00', '09:00']) : closed)))).toMatch(/^Martes: .*iguales/)
    expect(validateWeek(week((i) => (i === SA ? open(['09:00', '14:00'], ['13:00', '18:00']) : closed)))).toMatch(/^Sábado: .*solapan/)
    expect(validateWeek(week((i) => (i === SU ? open(['9', '14:00']) : closed)))).toMatch(/^Domingo: completa/)
    expect(validateWeek(week(() => open(['08:00', '09:00'], ['10:00', '11:00'], ['12:00', '13:00'], ['14:00', '15:00'])))).toMatch(/máximo 3/)
    expect(validateWeek([closed])).toMatch(/7 días/)
  })
})

describe('toStoredHours', () => {
  it('formato de places.hours', () => {
    expect(toStoredHours({ mode: 'unset', days: emptyWeek() })).toBeNull()
    expect(toStoredHours({ mode: 'always', days: emptyWeek() })).toEqual({ osm_raw: '24/7', source: 'owner' })
    expect(toStoredHours({ mode: 'custom', days: emptyWeek() })).toEqual({ osm_raw: 'Mo-Su off', source: 'owner' })
    expect(toStoredHours({ mode: 'custom', days: week(() => open(['10:00', '22:00'])) }))
      .toEqual({ osm_raw: 'Mo-Su 10:00-22:00', source: 'owner' })
  })

  it('"todo cerrado" se evalúa como cerrado, no como desconocido', () => {
    expect(isOpenNow('Mo-Su off', MO, at(12))).toBe(false)
  })
})

describe('hoursInputSchema', () => {
  const valid = { mode: 'custom', days: week((i) => (i < 5 ? open(['09:00', '18:00']) : closed)) }

  it('acepta el JSON del editor', () => {
    expect(hoursInputSchema.safeParse(parseHoursField(JSON.stringify(valid))).success).toBe(true)
  })

  it('rechaza semanas inválidas con mensaje legible', () => {
    const bad = { mode: 'custom', days: week(() => open(['09:00', '09:00'])) }
    const r = hoursInputSchema.safeParse(bad)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/^Horario — Lunes/)
    expect(hoursInputSchema.safeParse({ mode: 'custom', days: [] }).success).toBe(false)
    expect(hoursInputSchema.safeParse({ mode: 'otro', days: valid.days }).success).toBe(false)
    expect(hoursInputSchema.safeParse({ mode: 'custom', days: week(() => open(['25:00', '26:00'])) }).success).toBe(false)
  })

  it('en modo 24 h o sin horario no valida los días', () => {
    expect(hoursInputSchema.safeParse({ mode: 'always', days: week(() => ({ closed: false, ranges: [] })) }).success).toBe(true)
  })

  it('parseHoursField: texto inválido o vacío -> undefined', () => {
    expect(parseHoursField('')).toBeUndefined()
    expect(parseHoursField(null)).toBeUndefined()
    expect(parseHoursField('{no json')).toBeUndefined()
  })
})
