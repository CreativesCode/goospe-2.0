import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEIGHTS, WEIGHT_FIELDS, WEIGHT_KEYS, diffWeights, isDefaultWeights, organicShares,
  parseWeights, readWeights, roundWeights,
} from '@/features/feed/ranking-weights'

describe('DEFAULT_WEIGHTS', () => {
  it('son los literales históricos de get_feed (cambiarlos cambia el ranking en producción)', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      distance: 0.45, distance_decay_m: 2500, trending: 0.25, novelty: 0.1, affinity: 0.2, boost: 1,
    })
  })
  it('cada peso tiene su campo de formulario y los originales caben en su rango', () => {
    expect(WEIGHT_FIELDS.map((f) => f.key).sort()).toEqual([...WEIGHT_KEYS].sort())
    for (const f of WEIGHT_FIELDS) {
      expect(DEFAULT_WEIGHTS[f.key]).toBeGreaterThanOrEqual(f.min)
      expect(DEFAULT_WEIGHTS[f.key]).toBeLessThanOrEqual(f.max)
    }
  })
  it('los rangos editables caben en lo que tolera el SQL (0–5 y 100–100000)', () => {
    for (const f of WEIGHT_FIELDS) {
      const [lo, hi] = f.key === 'distance_decay_m' ? [100, 100000] : [0, 5]
      expect(f.min).toBeGreaterThanOrEqual(lo)
      expect(f.max).toBeLessThanOrEqual(hi)
    }
  })
})

describe('parseWeights', () => {
  it('acepta los originales', () => {
    expect(parseWeights(DEFAULT_WEIGHTS)).toEqual({ ok: true, weights: DEFAULT_WEIGHTS })
  })
  it('acepta texto de formulario, con punto o coma decimal', () => {
    const r = parseWeights({ distance: '0,5', distance_decay_m: '3000', trending: '0.25', novelty: ' 0.1 ', affinity: '0.2', boost: '1' })
    expect(r).toEqual({ ok: true, weights: { ...DEFAULT_WEIGHTS, distance: 0.5, distance_decay_m: 3000 } })
  })
  it('rechaza vacíos, texto y no finitos', () => {
    for (const bad of ['', 'abc', null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseWeights({ ...DEFAULT_WEIGHTS, trending: bad }).ok).toBe(false)
    }
  })
  it('rechaza fuera de rango y nombra el campo', () => {
    const neg = parseWeights({ ...DEFAULT_WEIGHTS, distance: -0.1 })
    expect(neg.ok).toBe(false)
    if (!neg.ok) expect(neg.error).toContain('Cercanía')
    expect(parseWeights({ ...DEFAULT_WEIGHTS, distance: 2.01 }).ok).toBe(false)
    expect(parseWeights({ ...DEFAULT_WEIGHTS, boost: 5.5 }).ok).toBe(false)
    expect(parseWeights({ ...DEFAULT_WEIGHTS, distance_decay_m: 0 }).ok).toBe(false)
    expect(parseWeights({ ...DEFAULT_WEIGHTS, distance_decay_m: 60000 }).ok).toBe(false)
  })
  it('rechaza claves que faltan', () => {
    const { boost: _omit, ...rest } = DEFAULT_WEIGHTS
    void _omit
    expect(parseWeights(rest).ok).toBe(false)
    expect(parseWeights(null).ok).toBe(false)
  })
  it('no deja el feed sin orden: algún peso orgánico debe ser > 0', () => {
    expect(parseWeights({ ...DEFAULT_WEIGHTS, distance: 0, trending: 0, novelty: 0, affinity: 0 }).ok).toBe(false)
    expect(parseWeights({ ...DEFAULT_WEIGHTS, distance: 0, trending: 0, novelty: 0.01, affinity: 0 }).ok).toBe(true)
  })
  it('redondea a 4 decimales y metros enteros', () => {
    const r = parseWeights({ ...DEFAULT_WEIGHTS, distance: 0.1 + 0.2, distance_decay_m: 2500.6 })
    expect(r.ok && r.weights.distance).toBe(0.3)
    expect(r.ok && r.weights.distance_decay_m).toBe(2501)
    expect(roundWeights({ ...DEFAULT_WEIGHTS, novelty: 0.123456 }).novelty).toBe(0.1235)
  })
  it('ignora claves desconocidas', () => {
    const r = parseWeights({ ...DEFAULT_WEIGHTS, open_now: 9 })
    expect(r.ok && Object.keys(r.weights).sort()).toEqual([...WEIGHT_KEYS].sort())
  })
})

describe('readWeights (misma regla que el SQL)', () => {
  it('sin fila, nulo o basura → originales', () => {
    for (const v of [null, undefined, 'x', 7, [], {}]) expect(readWeights(v)).toEqual(DEFAULT_WEIGHTS)
  })
  it('clave a clave: lo válido se usa, lo inválido cae al original', () => {
    expect(readWeights({ distance: 0.6, trending: '0.9', novelty: -1, affinity: 6, boost: 2, distance_decay_m: 50 })).toEqual({
      ...DEFAULT_WEIGHTS, distance: 0.6, boost: 2,
    })
  })
  it('no lee la semilla vieja `ranking_weights` por error (otras claves)', () => {
    expect(readWeights({ recency: 0.05, open_now: 0.1, diversity: 0.1 })).toEqual(DEFAULT_WEIGHTS)
  })
})

describe('diffWeights / isDefaultWeights', () => {
  it('solo lo que cambia', () => {
    expect(diffWeights(DEFAULT_WEIGHTS, { ...DEFAULT_WEIGHTS, boost: 2 })).toEqual({ boost: { from: 1, to: 2 } })
    expect(diffWeights(DEFAULT_WEIGHTS, { ...DEFAULT_WEIGHTS })).toEqual({})
  })
  it('detecta los originales', () => {
    expect(isDefaultWeights({ ...DEFAULT_WEIGHTS })).toBe(true)
    expect(isDefaultWeights({ ...DEFAULT_WEIGHTS, novelty: 0.11 })).toBe(false)
  })
})

describe('organicShares', () => {
  it('reparte el 100 % entre los cuatro factores orgánicos', () => {
    expect(organicShares(DEFAULT_WEIGHTS)).toEqual({ distance: 45, trending: 25, novelty: 10, affinity: 20 })
  })
  it('todo en cero no divide por cero', () => {
    expect(organicShares({ ...DEFAULT_WEIGHTS, distance: 0, trending: 0, novelty: 0, affinity: 0 }))
      .toEqual({ distance: 0, trending: 0, novelty: 0, affinity: 0 })
  })
})
