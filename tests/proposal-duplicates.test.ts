import { describe, expect, it } from 'vitest'
import {
  duplicateLevel, formatDistance, normalizeDuplicates, rankDuplicates, type DuplicateCandidate,
} from '@/features/admin/proposal-duplicates'

const cand = (patch: Partial<DuplicateCandidate>): DuplicateCandidate => ({
  id: 'a', slug: 'a', name: 'A', distance_m: null, similarity: 0, claimed: false, is_published: true, city_name: null, ...patch,
})

describe('duplicateLevel', () => {
  it('cerca y con nombre parecido: casi seguro', () => {
    expect(duplicateLevel({ distance_m: 20, similarity: 0.6 })).toBe('high')
    expect(duplicateLevel({ distance_m: 150, similarity: 0.45 })).toBe('high')
  })
  it('nombre casi idéntico con el pin algo corrido, o sin coordenadas: casi seguro', () => {
    expect(duplicateLevel({ distance_m: 800, similarity: 0.9 })).toBe('high')
    expect(duplicateLevel({ distance_m: null, similarity: 1 })).toBe('high')
  })
  it('solo cerca o solo parecido: posible', () => {
    expect(duplicateLevel({ distance_m: 30, similarity: 0.1 })).toBe('possible')
    expect(duplicateLevel({ distance_m: 1800, similarity: 0.5 })).toBe('possible')
    expect(duplicateLevel({ distance_m: null, similarity: 0.5 })).toBe('possible')
    expect(duplicateLevel({ distance_m: 5000, similarity: 0.95 })).toBe('possible') // mismo nombre, otra sucursal
  })
  it('lejos y distinto: no es candidato', () => {
    expect(duplicateLevel({ distance_m: 151, similarity: 0.44 })).toBeNull()
    expect(duplicateLevel({ distance_m: null, similarity: 0.2 })).toBeNull()
  })
})

describe('rankDuplicates', () => {
  it('descarta los que no son candidatos y ordena por probabilidad, parecido y cercanía', () => {
    const out = rankDuplicates([
      cand({ id: 'lejos', distance_m: 900, similarity: 0.1 }),
      cand({ id: 'vecino', distance_m: 10, similarity: 0.05 }),
      cand({ id: 'parecido', distance_m: 1500, similarity: 0.6 }),
      cand({ id: 'mismo', distance_m: 40, similarity: 0.7 }),
      cand({ id: 'vecino2', distance_m: 5, similarity: 0.05 }),
    ])
    expect(out.map((d) => d.id)).toEqual(['mismo', 'parecido', 'vecino2', 'vecino'])
    expect(out.map((d) => d.level)).toEqual(['high', 'possible', 'possible', 'possible'])
  })
})

describe('normalizeDuplicates / formatDistance', () => {
  it('sanea lo que devuelve la RPC', () => {
    expect(normalizeDuplicates(null)).toEqual([])
    expect(normalizeDuplicates([{ id: 1, name: 'x', similarity: 1 }, null, { id: 'a', name: 'A' }])).toEqual([])
    expect(normalizeDuplicates([{ id: 'a', slug: 's', name: 'A', distance_m: '12.5', similarity: '0.5', claimed: true, is_published: null, city_name: 'Osorno' }]))
      .toEqual([{ id: 'a', slug: 's', name: 'A', distance_m: 12.5, similarity: 0.5, claimed: true, is_published: false, city_name: 'Osorno' }])
    expect(normalizeDuplicates([{ id: 'a', name: 'A', distance_m: null, similarity: 0.9 }])[0].distance_m).toBeNull()
  })
  it('distancias legibles', () => {
    expect(formatDistance(null)).toBe('sin coordenadas')
    expect(formatDistance(119.6)).toBe('120 m')
    expect(formatDistance(1420)).toBe('1,4 km')
  })
})
