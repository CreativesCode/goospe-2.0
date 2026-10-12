import { afterEach, describe, expect, it, vi } from 'vitest'
import { cityNowParts, humanizeHours, isOpenNow, openNow } from '@/lib/hours'

// Días OSM: Mo=0 … Su=6. Minutos desde medianoche.
const [MO, TU, WE, TH, FR, SA, SU] = [0, 1, 2, 3, 4, 5, 6]
const at = (h: number, m = 0) => h * 60 + m

describe('isOpenNow', () => {
  it('sin dato devuelve null', () => {
    expect(isOpenNow(null, MO, at(10))).toBeNull()
    expect(isOpenNow(undefined, MO, at(10))).toBeNull()
    expect(isOpenNow('   ', MO, at(10))).toBeNull()
  })

  it('24/7 siempre abierto', () => {
    expect(isOpenNow('24/7', SU, at(3))).toBe(true)
  })

  it('horario sin días aplica todos los días', () => {
    expect(isOpenNow('09:00-21:00', SU, at(10))).toBe(true)
    expect(isOpenNow('09:00-21:00', SU, at(8, 59))).toBe(false)
    expect(isOpenNow('09:00-21:00', SU, at(21))).toBe(false) // el cierre es exclusivo
  })

  it('reglas separadas por punto y coma', () => {
    const h = 'Mo-Fr 08:00-20:30; Sa 09:00-20:30'
    expect(isOpenNow(h, MO, at(8))).toBe(true)
    expect(isOpenNow(h, FR, at(20, 29))).toBe(true)
    expect(isOpenNow(h, SA, at(8, 30))).toBe(false)
    expect(isOpenNow(h, SA, at(9))).toBe(true)
    expect(isOpenNow(h, SU, at(12))).toBe(false)
  })

  it('reglas separadas por coma', () => {
    const h = 'Mo-Fr 07:00-24:00, Sa,Su 08:00-24:00'
    expect(isOpenNow(h, MO, at(7, 30))).toBe(true)
    expect(isOpenNow(h, SA, at(7, 30))).toBe(false)
    expect(isOpenNow(h, SA, at(9))).toBe(true)
    expect(isOpenNow(h, SU, at(23, 59))).toBe(true)
    expect(isOpenNow(h, WE, at(6, 59))).toBe(false)
  })

  it('la coma entre días y entre franjas no abre regla nueva', () => {
    expect(isOpenNow('Fr,Sa 12:00-22:00', FR, at(13))).toBe(true)
    expect(isOpenNow('Fr,Sa 12:00-22:00', TH, at(13))).toBe(false)
    const partido = 'Mo-Su 13:00-16:00,20:00-24:00'
    expect(isOpenNow(partido, TU, at(14))).toBe(true)
    expect(isOpenNow(partido, TU, at(17))).toBe(false)
    expect(isOpenNow(partido, TU, at(21))).toBe(true)
  })

  it('rango de días que da la vuelta a la semana', () => {
    expect(isOpenNow('Sa-Mo 10:00-18:00', SU, at(11))).toBe(true)
    expect(isOpenNow('Sa-Mo 10:00-18:00', MO, at(11))).toBe(true)
    expect(isOpenNow('Sa-Mo 10:00-18:00', TU, at(11))).toBe(false)
  })

  it('rango nocturno: la madrugada pertenece al día en que empezó', () => {
    const h = 'Fr,Sa 18:00-02:00'
    expect(isOpenNow(h, FR, at(19))).toBe(true)
    expect(isOpenNow(h, SA, at(1))).toBe(true) // sigue la noche del viernes
    expect(isOpenNow(h, SU, at(1, 59))).toBe(true) // sigue la noche del sábado
    expect(isOpenNow(h, SU, at(2))).toBe(false)
    expect(isOpenNow(h, FR, at(1))).toBe(false) // el jueves no abre
    expect(isOpenNow(h, MO, at(1))).toBe(false)
    expect(isOpenNow(h, SU, at(19))).toBe(false)
  })

  it('cierre a las 00:00 equivale a medianoche', () => {
    expect(isOpenNow('18:00-00:00', WE, at(23, 59))).toBe(true)
    expect(isOpenNow('18:00-00:00', WE, at(0, 30))).toBe(false)
  })

  it('"off" y "closed" pisan las reglas anteriores para ese día', () => {
    expect(isOpenNow('Mo-Su 09:00-18:00; Tu off', TU, at(10))).toBe(false)
    expect(isOpenNow('Mo-Su 09:00-18:00; Tu off', WE, at(10))).toBe(true)
    expect(isOpenNow('09:00-18:00; Su closed', SU, at(10))).toBe(false)
    expect(isOpenNow('Mo off', MO, at(10))).toBe(false)
  })

  it('los festivos se ignoran sin volver desconocido el horario', () => {
    const h = 'Mo-Fr 09:00-18:00; PH off'
    expect(isOpenNow(h, MO, at(10))).toBe(true)
    expect(isOpenNow(h, SA, at(10))).toBe(false)
  })

  it('con reglas que no entiende no afirma "cerrado"', () => {
    const h = 'Mo-Fr 09:00-18:00; Dec 24 09:00-13:00'
    expect(isOpenNow(h, MO, at(10))).toBe(true)
    expect(isOpenNow(h, SA, at(10))).toBeNull()
    expect(isOpenNow('sunrise-sunset', MO, at(10))).toBeNull()
    expect(isOpenNow('Dec 25 off', MO, at(10))).toBeNull()
  })
})

describe('humanizeHours', () => {
  it('sin dato o sin nada legible devuelve null', () => {
    expect(humanizeHours(null)).toBeNull()
    expect(humanizeHours('')).toBeNull()
    expect(humanizeHours('sunrise-sunset')).toBeNull()
  })

  it('traduce días y horas', () => {
    expect(humanizeHours('24/7')).toEqual(['Abierto las 24 horas'])
    expect(humanizeHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00')).toEqual([
      'Lun a Vie: 09:00–18:00',
      'Sáb: 10:00–14:00',
    ])
    expect(humanizeHours('9:00-13:00,15:00-19:00')).toEqual(['Todos los días: 09:00–13:00 y 15:00–19:00'])
  })

  it('reglas separadas por coma, "off" y festivos', () => {
    expect(humanizeHours('Mo-Fr 07:00-24:00, Sa,Su 08:00-24:00')).toEqual([
      'Lun a Vie: 07:00–24:00',
      'Sáb, Dom: 08:00–24:00',
    ])
    expect(humanizeHours('Mo-Sa 10:00-20:00; Tu off')).toEqual(['Lun a Sáb: 10:00–20:00', 'Mar: Cerrado'])
    expect(humanizeHours('PH 10:00-14:00')).toEqual(['Festivos: 10:00–14:00'])
  })

  it('lista las reglas con el lunes primero, aunque los días cerrados vengan antes', () => {
    expect(humanizeHours('We off; Mo,Tu 09:00-18:00; Th-Su 10:00-14:00')).toEqual([
      'Lun, Mar: 09:00–18:00',
      'Mié: Cerrado',
      'Jue a Dom: 10:00–14:00',
    ])
    expect(humanizeHours('Sa,Su off; Mo-Fr 09:00-18:00; PH off')).toEqual([
      'Lun a Vie: 09:00–18:00',
      'Sáb, Dom: Cerrado',
      'Festivos: Cerrado',
    ])
    expect(humanizeHours('Mo off; Tu-Su 12:00-23:00')).toEqual(['Lun: Cerrado', 'Mar a Dom: 12:00–23:00'])
    // "Todos los días" va primero y su excepción después (mismo día inicial: orden original).
    expect(humanizeHours('Su closed; 09:00-18:00')).toEqual(['Todos los días: 09:00–18:00', 'Dom: Cerrado'])
  })

  it('deja tal cual la regla que no sabe traducir', () => {
    expect(humanizeHours('Mo-Fr 09:00-18:00; Dec 24 09:00-13:00')).toEqual([
      'Lun a Vie: 09:00–18:00',
      'Dec 24 09:00-13:00',
    ])
  })
})

describe('openNow por zona horaria de la ciudad', () => {
  afterEach(() => vi.useRealTimers())

  // Miércoles 15-jul-2026 02:30 UTC. Invierno austral / verano europeo.
  const JULIO = new Date('2026-07-15T02:30:00Z')
  // Jueves 15-ene-2026 02:30 UTC. Verano austral / invierno europeo.
  const ENERO = new Date('2026-01-15T02:30:00Z')

  it('Chile continental: UTC-4 en invierno, UTC-3 en verano', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JULIO)
    expect(cityNowParts('America/Santiago')).toEqual({ osmDay: TU, minutes: at(22, 30) })
    vi.setSystemTime(ENERO)
    expect(cityNowParts('America/Santiago')).toEqual({ osmDay: WE, minutes: at(23, 30) })
  })

  it('Magallanes no cambia de hora (UTC-3 todo el año)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JULIO)
    expect(cityNowParts('America/Punta_Arenas')).toEqual({ osmDay: TU, minutes: at(23, 30) })
  })

  it('España: península y Canarias', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JULIO)
    expect(cityNowParts('Europe/Madrid')).toEqual({ osmDay: WE, minutes: at(4, 30) })
    expect(cityNowParts('Atlantic/Canary')).toEqual({ osmDay: WE, minutes: at(3, 30) })
    vi.setSystemTime(ENERO)
    expect(cityNowParts('Europe/Madrid')).toEqual({ osmDay: TH, minutes: at(3, 30) })
    expect(cityNowParts('Atlantic/Canary')).toEqual({ osmDay: TH, minutes: at(2, 30) })
  })

  it('el mismo instante da resultados distintos según la ciudad', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JULIO)
    const hours = { osm_raw: 'Tu 18:00-23:00' }
    expect(openNow(hours, 'America/Santiago')).toBe(true) // martes 22:30
    expect(openNow(hours, 'Europe/Madrid')).toBe(false) // miércoles 04:30
  })

  it('un bar nocturno sigue abierto de madrugada en su zona', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JULIO)
    const hours = { osm_raw: 'Tu 20:00-05:00' }
    expect(openNow(hours, 'Europe/Madrid')).toBe(true) // miércoles 04:30, noche del martes
    expect(openNow(hours, 'America/Santiago')).toBe(true) // martes 22:30
    expect(openNow({ osm_raw: 'We 20:00-05:00' }, 'Europe/Madrid')).toBe(false)
  })

  it('sin horario devuelve null y una zona corrupta no rompe', () => {
    expect(openNow(null, 'America/Santiago')).toBeNull()
    expect(openNow({ osm_raw: null }, 'America/Santiago')).toBeNull()
    expect(openNow({ osm_raw: '24/7' }, 'Marte/Olympus')).toBe(true)
    const parts = cityNowParts('Marte/Olympus')
    expect(parts.osmDay).toBeGreaterThanOrEqual(0)
    expect(parts.osmDay).toBeLessThanOrEqual(6)
  })
})
