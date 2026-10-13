import { describe, expect, it } from 'vitest'
import {
  CITY_COOKIE, cityChoiceFromCookieHeader, filterCities, foldText, groupByCountry, matchActiveCity,
  parseCityChoice, serializeCityChoice,
} from '@/lib/city-choice'

const granada = { id: 23, slug: 'granada-es', name: 'Granada', lat: 37.1735, lng: -3.5995 }
const maullin = { id: 10, slug: 'maullin-cl', name: 'Maullín', lat: -41.616, lng: -73.5951 }

describe('matchActiveCity: la cookie no es de fiar', () => {
  const active = [
    { ...granada, lat: 37.18, lng: -3.6, region: 'Andalucía', country: 'España', timezone: 'Europe/Madrid', places: 12 },
  ]
  it('una ciudad activa vale, con los datos del SERVIDOR (no los de la cookie)', () => {
    const tampered = { ...granada, name: 'Otra cosa', lat: 0, lng: 0 }
    expect(matchActiveCity(tampered, active)).toBe(active[0])
    expect(matchActiveCity(tampered, active)?.lat).toBe(37.18)
  })
  it('una ciudad inactiva o inventada se ignora', () => {
    expect(matchActiveCity(maullin, active)).toBeNull()
    expect(matchActiveCity({ id: 999, slug: 'atlantida', name: 'Atlántida', lat: 0, lng: 0 }, active)).toBeNull()
  })
  it('id y slug deben coincidir los dos', () => {
    expect(matchActiveCity({ ...granada, id: 24 }, active)).toBeNull()
    expect(matchActiveCity({ ...granada, slug: 'granada' }, active)).toBeNull()
  })
  it('sin elección o sin ciudades activas: null', () => {
    expect(matchActiveCity(null, active)).toBeNull()
    expect(matchActiveCity(granada, [])).toBeNull()
  })
})

describe('cookie de ciudad', () => {
  it('ida y vuelta, también con acentos', () => {
    expect(parseCityChoice(serializeCityChoice(granada))).toEqual(granada)
    expect(parseCityChoice(serializeCityChoice(maullin))).toEqual(maullin)
  })
  it('solo guarda los cinco campos del contrato', () => {
    const raw = serializeCityChoice({ ...granada, region: 'Andalucía', places: 1481 } as typeof granada)
    expect(Object.keys(JSON.parse(decodeURIComponent(raw))).sort()).toEqual(['id', 'lat', 'lng', 'name', 'slug'])
  })
  it('el valor es seguro para una cookie (sin ; , ni espacios)', () => {
    expect(serializeCityChoice({ ...maullin, name: 'San Martín; de, la Vega' })).not.toMatch(/[;,\s]/)
  })
  it('acepta también el JSON sin codificar', () => {
    expect(parseCityChoice(JSON.stringify(granada))).toEqual(granada)
  })
  it('cualquier cosa inválida → null (la cookie la escribe el cliente)', () => {
    const bad = [
      null, undefined, '', 'granada-es', '%7B', '{"id":1}', '%E0%A4%A',
      JSON.stringify({ ...granada, id: -1 }),
      JSON.stringify({ ...granada, id: 1.5 }),
      JSON.stringify({ ...granada, slug: '../x' }),
      JSON.stringify({ ...granada, lat: 91 }),
      JSON.stringify({ ...granada, lng: '-3.6' }),
      JSON.stringify({ ...granada, name: '' }),
      JSON.stringify({ ...granada, name: 'x'.repeat(700) }),
    ]
    for (const v of bad) expect(parseCityChoice(v)).toBeNull()
  })
  it('se lee de una cabecera Cookie entre otras cookies', () => {
    const header = `sb-x-auth-token=abc; ${CITY_COOKIE}=${serializeCityChoice(granada)}; theme=dark`
    expect(cityChoiceFromCookieHeader(header)).toEqual(granada)
    expect(cityChoiceFromCookieHeader('theme=dark')).toBeNull()
    expect(cityChoiceFromCookieHeader(`x${CITY_COOKIE}=1`)).toBeNull()
    expect(cityChoiceFromCookieHeader(null)).toBeNull()
  })
})

const cities = [
  { name: 'Granada', region: 'Andalucía', country: 'España' },
  { name: 'Maullín', region: 'Los Lagos', country: 'Chile' },
  { name: 'Puerto Varas', region: 'Los Lagos', country: 'Chile' },
  { name: 'Puerto de la Cruz', region: 'Canarias', country: 'España' },
  { name: 'La Zubia', region: null, country: 'España' },
]

describe('buscador de ciudades', () => {
  it('foldText quita acentos y mayúsculas', () => {
    expect(foldText('  MaullÍN ')).toBe('maullin')
  })
  it('sin texto devuelve todas', () => {
    expect(filterCities(cities, '  ')).toBe(cities)
  })
  it('encuentra sin acentos ni mayúsculas', () => {
    expect(filterCities(cities, 'maullin').map((c) => c.name)).toEqual(['Maullín'])
    expect(filterCities(cities, 'ANDALUCIA').map((c) => c.name)).toEqual(['Granada'])
  })
  it('primero las que empiezan por el texto, luego las que lo contienen', () => {
    expect(filterCities(cities, 'puerto').map((c) => c.name)).toEqual(['Puerto Varas', 'Puerto de la Cruz'])
    expect(filterCities(cities, 'la').map((c) => c.name)).toEqual(['La Zubia', 'Maullín', 'Puerto Varas', 'Puerto de la Cruz'])
  })
  it('busca por país y tolera región nula', () => {
    expect(filterCities(cities, 'chile').map((c) => c.name)).toEqual(['Maullín', 'Puerto Varas'])
    expect(filterCities(cities, 'zzz')).toEqual([])
  })
  it('agrupa por país conservando el orden', () => {
    expect(groupByCountry(cities).map((g) => [g.country, g.cities.length])).toEqual([['España', 3], ['Chile', 2]])
  })
})
