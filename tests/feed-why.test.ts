import { describe, expect, it } from 'vitest'
import { buildWhy } from '@/features/feed/feed-why'

const base = { distance_m: 350, rating: 0, reviews_count: 0, price_level: null, tags: null }

describe('buildWhy', () => {
  it('con solo la distancia da una frase completa', () => {
    expect(buildWhy(base)).toBe('Está a 4 min a pie.')
  })

  it('combina valoración, precio y etiquetas con comas y "y"', () => {
    const why = buildWhy({ distance_m: 1200, rating: 4.72, reviews_count: 12, price_level: 1, tags: ['terraza', 'vista al lago', 'kuchen'] })
    expect(why).toBe('Está a 3 min en auto, tiene 4.7 de valoración, es económico y destaca por terraza y vista al lago.')
  })

  it('no presume de valoración sin reseñas ni por debajo de 4', () => {
    expect(buildWhy({ ...base, rating: 4.9 })).toBe('Está a 4 min a pie.')
    expect(buildWhy({ ...base, rating: 3.2, reviews_count: 8 })).toBe('Está a 4 min a pie.')
  })

  it('ignora etiquetas vacías', () => {
    expect(buildWhy({ ...base, tags: [' ', 'tranquilo'] })).toBe('Está a 4 min a pie y destaca por tranquilo.')
  })
})
