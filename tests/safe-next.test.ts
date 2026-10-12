import { describe, expect, it } from 'vitest'
import { safeNext } from '@/lib/safe-next'

describe('safeNext', () => {
  it.each([
    '/feed',
    '/places/cafe-del-lago',
    '/panel/123?tab=eventos#top',
    '/login?next=https://evil.com', // el destino externo va como dato de la query, no como ruta
  ])('acepta rutas internas: %s', (v) => {
    expect(safeNext(v)).toBe(v)
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['backslash tras la barra', '/\\evil.com'],
    ['backslash más adelante', '/foo\\bar'],
    ['URL absoluta', 'https://x'],
    ['URL absoluta http', 'http://evil.com/feed'],
    ['javascript:', 'javascript:alert(1)'],
    ['esquema tras la barra', '/javascript:alert(1)'],
    ['esquema tras varias barras', '///evil.com'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['ruta relativa', 'feed'],
    ['salto de línea', '/feed\nLocation: https://evil.com'],
    ['retorno de carro', '/feed\r\n'],
    ['tabulador', '/\t/evil.com'],
    ['carácter nulo', '/feed\u0000'],
    ['vacío', ''],
    ['espacio inicial', ' /feed'],
  ])('rechaza %s', (_label, v) => {
    expect(safeNext(v)).toBe('/feed')
  })

  it('rechaza valores que no son texto', () => {
    expect(safeNext(undefined)).toBe('/feed')
    expect(safeNext(null)).toBe('/feed')
    expect(safeNext(['/feed', '//evil.com'])).toBe('/feed')
    expect(safeNext(42)).toBe('/feed')
  })

  it('rechaza destinos desmesurados', () => {
    expect(safeNext('/' + 'a'.repeat(2000))).toBe('/feed')
    expect(safeNext('/' + 'a'.repeat(1999))).toHaveLength(2000)
  })

  it('usa el fallback indicado', () => {
    expect(safeNext('//evil.com', '/panel')).toBe('/panel')
  })
})
