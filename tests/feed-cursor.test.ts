import { describe, expect, it } from 'vitest'
import {
  cursorArgs, cursorOf, distanceFloor, isStalledPage, mergePage, pageIsFull, positionKey, scoreCeiling,
} from '@/features/feed/feed-cursor'

const row = (id: string, score: number, distance_m: number) => ({ id, score, distance_m })
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const C = '00000000-0000-0000-0000-00000000000c'

describe('cursorOf', () => {
  it('toma score, distancia e id de la ÚLTIMA fila', () => {
    expect(cursorOf([row(A, 0.9, 10), row(B, 0.5, 300.25)])).toEqual({ score: 0.5, dist: 300.25, id: B })
  })
  it('sin filas no hay cursor', () => {
    expect(cursorOf([])).toBeNull()
  })
  it('sin score (BD anterior a la migración) o con valores no finitos no hay cursor', () => {
    expect(cursorOf([{ id: A, distance_m: 10 }])).toBeNull()
    expect(cursorOf([{ id: A, distance_m: 10, score: null }])).toBeNull()
    expect(cursorOf([row(A, Number.NaN, 10)])).toBeNull()
    expect(cursorOf([row(A, 0.5, Number.POSITIVE_INFINITY)])).toBeNull()
  })
  it('guarda los valores tal como llegan (la cota se aplica al enviarlos)', () => {
    const score = 0.1 + 0.2 // 0.30000000000000004
    const c = cursorOf([row(A, score, 1234.5678901234567)])
    expect(c?.score).toBe(score)
    expect(c?.dist).toBe(1234.5678901234567)
  })
  it('un score 0 es un cursor válido', () => {
    expect(cursorOf([row(A, 0, 0)])).toEqual({ score: 0, dist: 0, id: A })
  })
})

// Lo que hace Postgres con `extra_float_digits = 0`: escribe el double con 15 cifras
// significativas. Es el valor que recibe el navegador en vez del score real.
const pg15 = (x: number) => Number(x.toPrecision(15))

// Réplica del filtro de get_feed (migración 0043): "estrictamente después del cursor".
type Row = { id: string; score: number; distance_m: number }
const after = (r: Row, a: ReturnType<typeof cursorArgs>) =>
  r.score < a.p_after_score ||
  (r.score === a.p_after_score &&
    (r.distance_m > a.p_after_dist || (r.distance_m === a.p_after_dist && r.id > a.p_after_id)))
const ordered = (rows: Row[]) =>
  [...rows].sort((x, y) => y.score - x.score || x.distance_m - y.distance_m || (x.id < y.id ? -1 : 1))

/**
 * Pagina `rows` como lo hace useFeed.loadMore: cursor de la última fila RECIBIDA (redondeada),
 * mergePage para unir y, si el cursor se atasca, offset para el resto.
 */
function paginate(rows: Row[], size: number) {
  const sorted = ordered(rows)
  const wire = (r: Row): Row => ({ id: r.id, score: pg15(r.score), distance_m: pg15(r.distance_m) })
  let got: Row[] = sorted.slice(0, size).map(wire)
  let last = got
  let repeated = 0
  let byOffset = false
  for (let guard = 0; guard < 1000 && pageIsFull(last.length, size); guard++) {
    const seen = new Set(got.map((r) => r.id))
    const offsetPage = () => sorted.slice(seen.size, seen.size + size).map(wire)
    let page = offsetPage()
    if (!byOffset) {
      const args = JSON.parse(JSON.stringify(cursorArgs(cursorOf(last)!))) // viaja como JSON
      page = sorted.filter((r) => after(r, args)).slice(0, size).map(wire)
      if (isStalledPage(page, seen, size)) {
        byOffset = true
        page = offsetPage()
      }
    }
    repeated += page.filter((r) => seen.has(r.id)).length
    got = mergePage(got, page)
    last = page
  }
  return { ids: got.map((r) => r.id), expected: sorted.map((r) => r.id), repeated, byOffset }
}

// Generador determinista (sin Math.random: el test debe dar siempre lo mismo).
function lcg(seed: number) {
  let s = seed >>> 0
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32
}
const uuid = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, '0')}`

describe('cursorArgs', () => {
  it('mapea a los parámetros de get_feed', () => {
    const a = cursorArgs({ score: 0.42, dist: 150, id: A })
    expect(Object.keys(a)).toEqual(['p_after_score', 'p_after_dist', 'p_after_id'])
    expect(a.p_after_id).toBe(A)
  })
  it('envía una cota: score ≥ el recibido y distancia ≤ la recibida, a menos de 1e-13 relativo', () => {
    const a = cursorArgs({ score: 0.457475443487066, dist: 237.69380459, id: A })
    expect(a.p_after_score).toBeGreaterThan(0.457475443487066)
    expect(a.p_after_score / 0.457475443487066 - 1).toBeLessThan(1e-13)
    expect(a.p_after_dist).toBeLessThan(237.69380459)
    expect(1 - a.p_after_dist / 237.69380459).toBeLessThan(1e-13)
  })
  it('la cota sobrevive el viaje por JSON', () => {
    const a = cursorArgs({ score: 0.457475443487066, dist: 237.69380459, id: A })
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
  })
})

describe('scoreCeiling / distanceFloor', () => {
  it('cubren el redondeo a 15 cifras de CUALQUIER double, hacia arriba o hacia abajo', () => {
    const rnd = lcg(7)
    for (let i = 0; i < 20000; i++) {
      // scores reales: de ~1e-6 a ~10, también negativos (la afinidad puede restar)
      const real = (rnd() < 0.1 ? -1 : 1) * rnd() * 10 ** (Math.floor(rnd() * 8) - 6)
      expect(scoreCeiling(pg15(real))).toBeGreaterThanOrEqual(real)
      const dist = rnd() * 25000
      expect(distanceFloor(pg15(dist))).toBeLessThanOrEqual(dist)
    }
  })
  it('los dos sentidos del redondeo que rompían el cursor exacto', () => {
    const up = 0.7999999999999999 // se recibe 0.8 (> real): `score < 0.8` repetía la última fila
    expect(pg15(up)).toBeGreaterThan(up)
    expect(scoreCeiling(pg15(up))).toBeGreaterThanOrEqual(up)
    const down = 0.1 + 0.2 // 0.30000000000000004 se recibe como 0.3 (< real): se saltaban filas
    expect(pg15(down)).toBeLessThan(down)
    expect(scoreCeiling(pg15(down))).toBeGreaterThanOrEqual(down)
  })
  it('el 0 es exacto (un double distinto de cero nunca se imprime "0")', () => {
    expect(scoreCeiling(0)).toBe(0)
    expect(distanceFloor(0)).toBe(0)
    expect(pg15(5e-324)).not.toBe(0)
  })
})

describe('paginación completa con valores redondeados (como llegan de la BD)', () => {
  it('ni repite ni salta filas, y conserva el orden', () => {
    const rnd = lcg(42)
    const rows: Row[] = Array.from({ length: 487 }, (_, i) => ({
      id: uuid(i), score: 0.45 * Math.exp(-rnd() * 10) + 0.1 * rnd() + 0.25 * rnd(), distance_m: rnd() * 25000,
    }))
    const { ids, expected, repeated, byOffset } = paginate(rows, 40)
    expect(ids).toEqual(expected)
    expect(byOffset).toBe(false)
    // Lo normal: cada página repite solo la última fila de la anterior (y mergePage la quita).
    expect(repeated).toBeLessThanOrEqual(Math.ceil(rows.length / 40) * 2)
  })
  it('empates pequeños de score (menos de una página): los resuelve el cursor', () => {
    const rnd = lcg(5)
    const rows: Row[] = Array.from({ length: 300 }, (_, i) => ({
      id: uuid(i), score: Math.floor(rnd() * 60) / 7, distance_m: i % 5 === 0 ? 1234.5678901234567 : rnd() * 9000,
    }))
    const { ids, expected, byOffset } = paginate(rows, 40)
    expect(ids).toEqual(expected)
    expect(byOffset).toBe(false)
  })
  it('más de una página con el MISMO score: el cursor se atasca y sigue por offset, sin repetir ni saltar', () => {
    const rnd = lcg(3)
    const rows: Row[] = Array.from({ length: 203 }, (_, i) => ({
      id: uuid(i), score: [0.5, 0.25, 1 / 3][i % 3], distance_m: rnd() * 9000,
    }))
    const { ids, expected, byOffset } = paginate(rows, 40)
    expect(ids).toEqual(expected)
    expect(byOffset).toBe(true)
  })
  it('todos los pesos a cero (score 0 para todos): pagina por distancia sin atascarse', () => {
    const rnd = lcg(11)
    const rows: Row[] = Array.from({ length: 150 }, (_, i) => ({ id: uuid(i), score: 0, distance_m: rnd() * 25000 }))
    const { ids, expected } = paginate(rows, 40)
    expect(ids).toEqual(expected)
  })
})

describe('isStalledPage', () => {
  const seen = new Set([A, B])
  it('página llena de filas ya recibidas → el cursor no avanza', () => {
    expect(isStalledPage([{ id: A }, { id: B }], seen, 2)).toBe(true)
  })
  it('basta una fila nueva para seguir con el cursor', () => {
    expect(isStalledPage([{ id: A }, { id: C }], seen, 2)).toBe(false)
  })
  it('una página corta es el final del feed, no un atasco', () => {
    expect(isStalledPage([{ id: A }], seen, 2)).toBe(false)
    expect(isStalledPage([], seen, 2)).toBe(false)
  })
})

describe('mergePage', () => {
  it('añade al final en el orden recibido', () => {
    expect(mergePage([{ id: A }], [{ id: B }, { id: C }]).map((r) => r.id)).toEqual([A, B, C])
  })
  it('no duplica lo ya cargado ni lo repetido dentro de la misma página', () => {
    expect(mergePage([{ id: A }, { id: B }], [{ id: B }, { id: C }, { id: C }]).map((r) => r.id)).toEqual([A, B, C])
  })
  it('omite lo que el usuario descartó', () => {
    expect(mergePage([{ id: A }], [{ id: B }, { id: C }], new Set([B])).map((r) => r.id)).toEqual([A, C])
  })
  it('devuelve la misma referencia si la página no aporta nada (no re-renderiza)', () => {
    const prev = [{ id: A }]
    expect(mergePage(prev, [{ id: A }])).toBe(prev)
    expect(mergePage(prev, [])).toBe(prev)
  })
  it('no muta la lista anterior', () => {
    const prev = [{ id: A }]
    mergePage(prev, [{ id: B }])
    expect(prev).toHaveLength(1)
  })
})

describe('pageIsFull', () => {
  it('hay más páginas solo si la última vino llena', () => {
    expect(pageIsFull(40, 40)).toBe(true)
    expect(pageIsFull(39, 40)).toBe(false)
    expect(pageIsFull(0, 40)).toBe(false)
  })
})

describe('positionKey', () => {
  it('agrupa posiciones a ~11 m y separa ciudades', () => {
    expect(positionKey(-41.31951, -72.98541)).toBe(positionKey(-41.31953, -72.98543))
    expect(positionKey(-41.3195, -72.9854)).not.toBe(positionKey(37.1735, -3.5995))
  })
})
