import { describe, expect, it } from 'vitest'
import { firstIssue } from '@/features/business/listing-schema'
import { approveProposalSchema, placeProposalSchema } from '@/features/business/place-proposal-schema'

const base = {
  name: ' Café Mawen ', category_id: '3', address: 'Santa Rosa 218', city_id: '1', city_name: null,
  reference: '-41.3195, -72.9854', phone: '', website: '', message: '',
}
const parse = (patch: Record<string, unknown> = {}) => placeProposalSchema.safeParse({ ...base, ...patch })
const issue = (patch: Record<string, unknown>) => {
  const r = parse(patch)
  return r.success ? null : firstIssue(r.error)
}

describe('placeProposalSchema', () => {
  it('mínimo válido: recorta y deja los opcionales en null', () => {
    const r = parse()
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toMatchObject({
        name: 'Café Mawen', category_id: 3, address: 'Santa Rosa 218', city_id: 1, city_name: null,
        phone: null, website: null, message: null,
      })
    }
  })

  it('nombre y dirección obligatorios y acotados', () => {
    expect(issue({ name: 'x' })).toMatch(/Nombre/)
    expect(issue({ name: 'x'.repeat(121) })).toMatch(/Nombre/)
    expect(issue({ name: null })).toMatch(/Nombre/)
    expect(issue({ address: '' })).toMatch(/Dirección/)
    expect(issue({ address: 'x'.repeat(201) })).toMatch(/Dirección/)
  })

  it('categoría: entero positivo', () => {
    for (const bad of ['', 'abc', '0', '-2', '1.5', null]) expect(issue({ category_id: bad })).toMatch(/categoría/)
  })

  it('ciudad: de la lista o escrita a mano, una de las dos', () => {
    expect(issue({ city_id: '', city_name: '' })).toMatch(/ciudad/)
    expect(issue({ city_id: 'other', city_name: null })).toMatch(/ciudad/)
    const r = parse({ city_id: '', city_name: ' Valdivia, Chile ' })
    expect(r.success && r.data).toMatchObject({ city_id: null, city_name: 'Valdivia, Chile' })
    expect(issue({ city_id: '', city_name: 'x'.repeat(81) })).toMatch(/Ciudad/)
  })

  it('ubicación: enlace, coordenadas o descripción, pero algo', () => {
    expect(issue({ reference: '' })).toMatch(/Ubicación/)
    expect(issue({ reference: 'x'.repeat(501) })).toMatch(/Ubicación/)
    expect(parse({ reference: 'https://maps.app.goo.gl/abc123' }).success).toBe(true)
    expect(parse({ reference: 'Frente a la plaza, al lado del banco' }).success).toBe(true)
  })

  it('teléfono y sitio web con las reglas de la ficha', () => {
    expect(issue({ phone: 'abc' })).toMatch(/Teléfono/)
    expect(parse({ phone: '+56 9 1234 5678' }).data?.phone).toBe('+56 9 1234 5678')
    expect(parse({ website: 'mawen.cl' }).data?.website).toBe('https://mawen.cl')
    expect(issue({ website: 'javascript:alert(1)' })).toMatch(/Sitio web/)
    expect(issue({ message: 'x'.repeat(1001) })).toMatch(/Nota/)
  })
})

describe('approveProposalSchema', () => {
  const ok = { lat: '-41.3195', lng: '-72.9854', city_id: '', confirm_duplicate: null }
  it('pin obligatorio y en rango; coma decimal aceptada', () => {
    expect(approveProposalSchema.parse(ok)).toEqual({ lat: -41.3195, lng: -72.9854, city_id: null, confirm_duplicate: false })
    expect(approveProposalSchema.parse({ ...ok, lat: '-41,3195' }).lat).toBe(-41.3195)
    expect(approveProposalSchema.safeParse({ ...ok, lat: '' }).success).toBe(false)
    expect(approveProposalSchema.safeParse({ ...ok, lng: null }).success).toBe(false)
    expect(approveProposalSchema.safeParse({ ...ok, lat: '91' }).success).toBe(false)
    expect(approveProposalSchema.safeParse({ ...ok, lng: '-181' }).success).toBe(false)
    expect(approveProposalSchema.safeParse({ ...ok, lat: 'abc' }).success).toBe(false)
  })
  it('ciudad opcional y casilla de duplicado', () => {
    expect(approveProposalSchema.parse({ ...ok, city_id: '4' }).city_id).toBe(4)
    expect(approveProposalSchema.parse({ ...ok, confirm_duplicate: 'on' }).confirm_duplicate).toBe(true)
    expect(approveProposalSchema.parse({ ...ok, confirm_duplicate: 'no' }).confirm_duplicate).toBe(false)
  })
  it('mensaje claro cuando falta el pin', () => {
    const r = approveProposalSchema.safeParse({ ...ok, lat: '' })
    expect(r.success ? '' : firstIssue(r.error)).toMatch(/latitud/)
  })
})
