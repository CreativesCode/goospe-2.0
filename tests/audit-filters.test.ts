import { describe, expect, it } from 'vitest'
import {
  AUDIT_ACTOR_MAX, auditQuery, pageCount, parseAuditFilters, payloadDiff, showValue,
} from '@/features/admin/audit-filters'
import { deltaVsPrevious } from '@/features/analytics/metrics'

describe('parseAuditFilters', () => {
  it('sin parámetros: todo, página 1', () => {
    expect(parseAuditFilters({})).toEqual({ prefix: null, objectType: null, actor: '', page: 1 })
  })
  it('prefijo de una lista cerrada (con o sin punto)', () => {
    expect(parseAuditFilters({ who: 'owner' }).prefix).toBe('owner.')
    expect(parseAuditFilters({ who: 'ADMIN.' }).prefix).toBe('admin.')
    expect(parseAuditFilters({ who: 'root' }).prefix).toBeNull()
    expect(parseAuditFilters({ who: '%' }).prefix).toBeNull()
  })
  it('tipo de objeto conocido o nada', () => {
    expect(parseAuditFilters({ type: 'place_proposal' }).objectType).toBe('place_proposal')
    expect(parseAuditFilters({ type: 'users; drop' }).objectType).toBeNull()
  })
  it('texto del actor recortado y acotado', () => {
    expect(parseAuditFilters({ q: '  demo@goospe.cl  ' }).actor).toBe('demo@goospe.cl')
    expect(parseAuditFilters({ q: 'a   b' }).actor).toBe('a b')
    expect(parseAuditFilters({ q: 'x'.repeat(500) }).actor).toHaveLength(AUDIT_ACTOR_MAX)
    expect(parseAuditFilters({ q: ['uno', 'dos'] }).actor).toBe('uno')
  })
  it('página: entero >= 1', () => {
    expect(parseAuditFilters({ page: '3' }).page).toBe(3)
    for (const bad of ['0', '-1', '1.5', 'abc', '']) expect(parseAuditFilters({ page: bad }).page).toBe(1)
    expect(parseAuditFilters({ page: '99999999' }).page).toBe(10_000)
  })
})

describe('auditQuery / pageCount', () => {
  it('ida y vuelta con los filtros', () => {
    const f = parseAuditFilters({ who: 'admin', type: 'claim', q: 'ana@x.cl', page: '2' })
    expect(auditQuery(f)).toBe('?who=admin&type=claim&q=ana%40x.cl&page=2')
    expect(auditQuery(f, 1)).toBe('?who=admin&type=claim&q=ana%40x.cl')
    expect(parseAuditFilters(Object.fromEntries(new URLSearchParams(auditQuery(f))))).toEqual(f)
    expect(auditQuery(parseAuditFilters({}))).toBe('')
  })
  it('páginas', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(50)).toBe(1)
    expect(pageCount(51)).toBe(2)
    expect(pageCount(43, 10)).toBe(5)
  })
})

describe('payloadDiff', () => {
  it('forma de diffFields: { campo: { before, after } }', () => {
    expect(payloadDiff({ phone: { before: null, after: '123' }, note: 'x' }))
      .toEqual({ rows: [{ field: 'phone', before: null, after: '123' }], rest: { note: 'x' } })
  })
  it('forma { before, after } con objetos y con valores sueltos', () => {
    expect(payloadDiff({ before: { is_published: true }, after: { is_published: false } }).rows)
      .toEqual([{ field: 'is_published', before: true, after: false }])
    expect(payloadDiff({ before: 'a.jpg', after: 'b.jpg', place_id: 'p' }))
      .toEqual({ rows: [{ field: 'valor', before: 'a.jpg', after: 'b.jpg' }], rest: { place_id: 'p' } })
    expect(payloadDiff({ before: { lat: 1 }, after: { lat: 2, lng: 3 } }).rows).toHaveLength(2)
  })
  it('sin cambios reconocibles: todo va al resto', () => {
    expect(payloadDiff({ reason: 'x', place_id: 'p' })).toEqual({ rows: [], rest: { reason: 'x', place_id: 'p' } })
    expect(payloadDiff(null)).toEqual({ rows: [], rest: {} })
    expect(payloadDiff(['a'])).toEqual({ rows: [], rest: {} })
  })
  it('showValue', () => {
    expect([showValue(null), showValue(''), showValue(true), showValue(3), showValue({ a: 1 })]).toEqual(['—', '—', 'sí', '3', '{"a":1}'])
  })
})

describe('deltaVsPrevious (boost de eventos)', () => {
  it('porcentaje frente al periodo previo', () => {
    expect(deltaVsPrevious(150, 100)).toEqual({ text: '+50 %', trend: 'up' })
    expect(deltaVsPrevious(50, 100)).toEqual({ text: '−50 %', trend: 'down' })
    expect(deltaVsPrevious(100, 100)).toEqual({ text: 'sin cambios', trend: 'flat' })
  })
  it('sin base previa no inventa un porcentaje', () => {
    expect(deltaVsPrevious(12, 0)).toEqual({ text: 'nuevo', trend: 'up' })
    expect(deltaVsPrevious(0, 0)).toEqual({ text: 'sin cambios', trend: 'flat' })
    expect(deltaVsPrevious(Number.NaN, 3).trend).toBe('none')
  })
})
