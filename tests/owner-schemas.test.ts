import { describe, expect, it } from 'vitest'
import { firstIssue } from '@/features/business/listing-schema'
import {
  brandVoiceSchema, buildAddress, cancelEventSchema, changeRequestSchema, ownerListingSchema,
  rejectReasonSchema, reviewReplySchema,
} from '@/features/business/owner-schemas'

const base = { category_ids: '1' }
const listing = (patch: Record<string, unknown>) => ownerListingSchema.safeParse({ ...base, ...patch })
const issue = (r: { success: boolean; error?: Parameters<typeof firstIssue>[0] }) => (r.success ? null : firstIssue(r.error!))

describe('ownerListingSchema', () => {
  it('mínimo válido: una categoría y nada más', () => {
    const r = listing({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toMatchObject({ email: null, street: null, street_number: null, category_ids: [1], tags: [] })
      expect(r.data.hours).toBeUndefined() // sin campo no se toca el horario
    }
  })

  it('email', () => {
    expect(listing({ email: ' hola@cafe.cl ' }).success && listing({ email: ' hola@cafe.cl ' }).data?.email).toBe('hola@cafe.cl')
    expect(issue(listing({ email: 'hola@cafe' }))).toMatch(/Email/)
    expect(issue(listing({ email: 'no es un correo' }))).toMatch(/Email/)
    expect(listing({ email: '' }).success).toBe(true)
  })

  it('categorías: entre 1 y 3, enteros positivos, sin repetidos', () => {
    expect(issue(ownerListingSchema.safeParse({ category_ids: '' }))).toMatch(/al menos una/)
    expect(issue(ownerListingSchema.safeParse({}))).toMatch(/al menos una/)
    expect(issue(listing({ category_ids: '1,2,3,4' }))).toMatch(/hasta 3/)
    expect(listing({ category_ids: '2, 2,5' }).data?.category_ids).toEqual([2, 5])
    expect(listing({ category_ids: '1,abc' }).success).toBe(false)
    expect(listing({ category_ids: '-1' }).success).toBe(false)
    expect(listing({ category_ids: '1.5' }).success).toBe(false)
  })

  it('horario: JSON del editor o ausente', () => {
    const days = Array.from({ length: 7 }, () => ({ closed: false, ranges: [{ from: '09:00', to: '18:00' }] }))
    expect(listing({ hours: JSON.stringify({ mode: 'custom', days }) }).data?.hours?.mode).toBe('custom')
    const bad = Array.from({ length: 7 }, () => ({ closed: false, ranges: [] }))
    expect(issue(listing({ hours: JSON.stringify({ mode: 'custom', days: bad }) }))).toMatch(/^Horario — Lunes/)
    expect(listing({ hours: '{roto' }).data?.hours).toBeUndefined()
  })

  it('hereda las reglas de la ficha básica', () => {
    expect(issue(listing({ phone: 'abc' }))).toMatch(/Teléfono/)
    expect(issue(listing({ street: 'x'.repeat(121) }))).toMatch(/Calle/)
  })
})

describe('buildAddress', () => {
  it('conserva la ciudad y recalcula formatted', () => {
    expect(buildAddress({ city: 'Osorno', street: 'Vieja', number: '1', formatted: 'Vieja 1' }, 'Manuel Rodríguez', '500'))
      .toEqual({ city: 'Osorno', street: 'Manuel Rodríguez', number: '500', formatted: 'Manuel Rodríguez 500' })
    expect(buildAddress({ city: 'Osorno' }, 'Benavente', null)).toEqual({ city: 'Osorno', street: 'Benavente', number: null, formatted: 'Benavente' })
  })

  it('sin dirección previa ni datos nuevos queda null', () => {
    expect(buildAddress(null, null, null)).toBeNull()
    expect(buildAddress({ city: 'Osorno' }, null, null)).toEqual({ city: 'Osorno', street: null, number: null, formatted: null })
  })
})

describe('reviewReplySchema', () => {
  it('recorta y exige contenido', () => {
    expect(reviewReplySchema.parse({ body: '  ¡Gracias por venir!  ' }).body).toBe('¡Gracias por venir!')
    expect(reviewReplySchema.safeParse({ body: ' ' }).success).toBe(false)
    expect(reviewReplySchema.safeParse({ body: null }).success).toBe(false)
  })

  it('tope de longitud y filtro de groserías', () => {
    expect(reviewReplySchema.safeParse({ body: 'a'.repeat(1000) }).success).toBe(true)
    expect(issue(reviewReplySchema.safeParse({ body: 'a'.repeat(1001) }))).toMatch(/máximo 1000/)
    expect(issue(reviewReplySchema.safeParse({ body: 'eres un idiota' }))).toMatch(/lenguaje ofensivo/)
    expect(reviewReplySchema.safeParse({ body: 'Un lugar económico, como dices' }).success).toBe(true)
  })
})

describe('rejectReasonSchema', () => {
  it('el motivo es obligatorio', () => {
    expect(issue(rejectReasonSchema.safeParse({ reason: '' }))).toMatch(/Motivo/)
    expect(issue(rejectReasonSchema.safeParse({ reason: 'no' }))).toMatch(/al menos 5/)
    expect(issue(rejectReasonSchema.safeParse({}))).toMatch(/Motivo/)
    expect(rejectReasonSchema.parse({ reason: ' No pudimos verificar el teléfono ' }).reason).toBe('No pudimos verificar el teléfono')
    expect(rejectReasonSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('changeRequestSchema', () => {
  it('cambio de nombre', () => {
    expect(changeRequestSchema.parse({ kind: 'name', name: ' Café Nuevo ', reference: null, message: '' }))
      .toEqual({ kind: 'name', name: 'Café Nuevo', message: null })
    expect(changeRequestSchema.safeParse({ kind: 'name', name: 'a' }).success).toBe(false)
    expect(changeRequestSchema.safeParse({ kind: 'name', name: 'x'.repeat(121) }).success).toBe(false)
  })

  it('cambio de ubicación', () => {
    const r = changeRequestSchema.parse({ kind: 'location', name: null, reference: '-41.31, -72.98', message: 'Nos mudamos' })
    expect(r).toEqual({ kind: 'location', reference: '-41.31, -72.98', message: 'Nos mudamos' })
    expect(changeRequestSchema.safeParse({ kind: 'location', reference: '' }).success).toBe(false)
  })

  it('tipo desconocido', () => {
    expect(changeRequestSchema.safeParse({ kind: 'slug', name: 'x' }).success).toBe(false)
    expect(changeRequestSchema.safeParse({ kind: null }).success).toBe(false)
  })
})

describe('brandVoiceSchema / cancelEventSchema', () => {
  it('tono de marca: vacío lo borra, tope 500', () => {
    expect(brandVoiceSchema.parse({ brand_voice: '  ' }).brand_voice).toBeNull()
    expect(brandVoiceSchema.parse({ brand_voice: ' cercano ' }).brand_voice).toBe('cercano')
    expect(brandVoiceSchema.safeParse({ brand_voice: 'x'.repeat(501) }).success).toBe(false)
  })

  it('motivo de cancelación opcional', () => {
    expect(cancelEventSchema.parse({ reason: null }).reason).toBeNull()
    expect(cancelEventSchema.parse({ reason: ' Lluvia ' }).reason).toBe('Lluvia')
    expect(cancelEventSchema.safeParse({ reason: 'x'.repeat(301) }).success).toBe(false)
  })
})
