import { describe, expect, it } from 'vitest'
import {
  EMPTY_SEARCH, cleanQuery, clearFilters, hasFilters, parseSearchState, sameSearch, searchApiQuery,
  searchHref, serializeSearchState,
} from '@/features/search/search-params'

describe('parseSearchState', () => {
  it('sin parámetros: estado vacío', () => {
    expect(parseSearchState(new URLSearchParams())).toEqual(EMPTY_SEARCH)
    expect(parseSearchState({})).toEqual(EMPTY_SEARCH)
  })
  it('lee todos los campos', () => {
    expect(parseSearchState(new URLSearchParams('q=café&city=granada-es&cat=2&price=3&open=1'))).toEqual({
      q: 'café', city: 'granada-es', cat: 2, price: 3, open: true,
    })
  })
  it('acepta el objeto searchParams de Next (valores repetidos → el primero)', () => {
    expect(parseSearchState({ q: ['pizza', 'sushi'], cat: '1', open: undefined })).toEqual({
      ...EMPTY_SEARCH, q: 'pizza', cat: 1,
    })
  })
  it('ignora valores inválidos en vez de fallar', () => {
    const s = parseSearchState(new URLSearchParams('cat=abc&price=9&open=true&city=Granada%20ES!&q='))
    expect(s).toEqual(EMPTY_SEARCH)
    expect(parseSearchState(new URLSearchParams('cat=0')).cat).toBeNull()
    expect(parseSearchState(new URLSearchParams('cat=-1')).cat).toBeNull()
    expect(parseSearchState(new URLSearchParams('cat=1.5')).cat).toBeNull()
    expect(parseSearchState(new URLSearchParams('price=0')).price).toBeNull()
    expect(parseSearchState(new URLSearchParams('cat=1e3')).cat).toBeNull()
  })
  it('normaliza el slug de ciudad a minúsculas', () => {
    expect(parseSearchState(new URLSearchParams('city=Puerto-Varas')).city).toBe('puerto-varas')
    expect(parseSearchState(new URLSearchParams('city=../admin')).city).toBeNull()
    expect(parseSearchState(new URLSearchParams(`city=${'a'.repeat(81)}`)).city).toBeNull()
  })
})

describe('cleanQuery', () => {
  it('recorta, colapsa espacios y quita caracteres de control', () => {
    expect(cleanQuery('  café   con\tleche\u0000 ')).toBe('café con leche')
  })
  it('máximo 80 caracteres', () => {
    expect(cleanQuery('x'.repeat(200))).toHaveLength(80)
  })
  it('nulo o vacío → cadena vacía', () => {
    expect(cleanQuery(null)).toBe('')
    expect(cleanQuery('   ')).toBe('')
  })
})

describe('serializeSearchState', () => {
  it('estado vacío → sin query string', () => {
    expect(serializeSearchState(EMPTY_SEARCH)).toBe('')
    expect(searchHref(EMPTY_SEARCH)).toBe('/search')
  })
  it('orden fijo y sin valores por defecto', () => {
    expect(serializeSearchState({ q: 'bar', city: 'osorno-cl', cat: 3, price: 2, open: true }))
      .toBe('q=bar&city=osorno-cl&cat=3&price=2&open=1')
    expect(serializeSearchState({ ...EMPTY_SEARCH, open: true })).toBe('open=1')
  })
  it('codifica el texto', () => {
    expect(searchHref({ ...EMPTY_SEARCH, q: 'café & té' })).toBe('/search?q=caf%C3%A9+%26+t%C3%A9')
  })
  it('ida y vuelta: parse(serialize(s)) = s', () => {
    const cases = [
      EMPTY_SEARCH,
      { q: 'café & té', city: 'puerto-varas', cat: 1, price: 4, open: true },
      { q: 'a=b?c#d', city: null, cat: null, price: 1, open: false },
      { q: '', city: 'granada-es', cat: 100000, price: null, open: true },
    ]
    for (const s of cases) expect(parseSearchState(new URLSearchParams(serializeSearchState(s)))).toEqual(s)
  })
  it('la misma búsqueda da la misma URL aunque el texto traiga espacios de más', () => {
    expect(sameSearch({ ...EMPTY_SEARCH, q: ' sushi ' }, { ...EMPTY_SEARCH, q: 'sushi' })).toBe(true)
    expect(sameSearch({ ...EMPTY_SEARCH, cat: 1 }, { ...EMPTY_SEARCH, cat: 2 })).toBe(false)
  })
})

describe('filtros', () => {
  it('la ciudad no cuenta como filtro', () => {
    expect(hasFilters({ ...EMPTY_SEARCH, city: 'osorno-cl' })).toBe(false)
    expect(hasFilters({ ...EMPTY_SEARCH, q: ' ' })).toBe(false)
    expect(hasFilters({ ...EMPTY_SEARCH, q: 'x' })).toBe(true)
    expect(hasFilters({ ...EMPTY_SEARCH, open: true })).toBe(true)
  })
  it('limpiar filtros conserva la ciudad', () => {
    expect(clearFilters({ q: 'x', city: 'osorno-cl', cat: 1, price: 2, open: true })).toEqual({ ...EMPTY_SEARCH, city: 'osorno-cl' })
  })
})

describe('searchApiQuery', () => {
  const pos = { lat: -41.3195, lng: -72.9854 }
  it('sin ciudad envía la posición', () => {
    expect(searchApiQuery({ ...EMPTY_SEARCH, q: 'bar' }, pos)).toBe('q=bar&lat=-41.3195&lng=-72.9854')
  })
  it('con ciudad NO envía la posición (se mide desde el centro de la ciudad)', () => {
    expect(searchApiQuery({ ...EMPTY_SEARCH, city: 'granada-es', open: true }, pos)).toBe('city=granada-es&open=1')
  })
  it('sin ciudad ni posición: solo los filtros', () => {
    expect(searchApiQuery({ ...EMPTY_SEARCH, cat: 2 }, null)).toBe('cat=2')
  })
})
