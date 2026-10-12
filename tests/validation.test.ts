import { describe, expect, it } from 'vitest'
import { isUuid, uuidSchema } from '@/lib/validation'

describe('isUuid / uuidSchema', () => {
  it.each([
    '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b', // v4
    '0190a6f0-7b3c-7d1e-9f2a-3b4c5d6e7f80', // v7
    '00000000-0000-0000-0000-000000000001', // sin versión RFC: válido en Postgres
    '3F2B8C1E-9A4D-4E6F-8B7A-1C2D3E4F5A6B',
  ])('acepta %s', (v) => {
    expect(isUuid(v)).toBe(true)
    expect(uuidSchema.safeParse(v).success).toBe(true)
  })

  it.each([
    ['sin guiones', '3f2b8c1e9a4d4e6f8b7a1c2d3e4f5a6b'],
    ['corto', '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6'],
    ['carácter no hex', '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6g'],
    ['con llaves', '{3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b}'],
    ['salto de línea final', '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b\n'],
    ['prefijo', 'x3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'],
    ['filtro PostgREST', '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b,id.neq.0'],
    ['vacío', ''],
  ])('rechaza %s', (_label, v) => {
    expect(isUuid(v)).toBe(false)
    expect(uuidSchema.safeParse(v).success).toBe(false)
  })

  it('rechaza valores que no son texto', () => {
    for (const v of [null, undefined, 123, {}, ['3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b']]) {
      expect(isUuid(v)).toBe(false)
      expect(uuidSchema.safeParse(v).success).toBe(false)
    }
  })
})
