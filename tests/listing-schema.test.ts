import { describe, expect, it } from 'vitest'
import { claimSchema, firstIssue, listingSchema } from '@/features/business/listing-schema'

// Un formulario vacío es válido: todos los campos son opcionales.
const parse = (patch: Record<string, unknown>) => listingSchema.safeParse(patch)
const ok = (patch: Record<string, unknown>) => {
  const r = parse(patch)
  if (!r.success) throw new Error(firstIssue(r.error))
  return r.data
}

describe('listingSchema', () => {
  it('formulario vacío: todo queda en null', () => {
    expect(ok({})).toEqual({
      description: null, vibe_line: null, phone: null, whatsapp: null,
      website: null, instagram: null, price_level: null, tags: [],
    })
    expect(ok({ phone: '   ', instagram: '', website: ' ' })).toMatchObject({
      phone: null, instagram: null, website: null,
    })
  })

  it.each([
    '+56 9 1234 5678',
    '+56912345678',
    '(65) 248 2888',
    '65/233343',
    '+34 600-123-456',
    '912.345.678',
  ])('teléfono válido: %s', (phone) => {
    expect(ok({ phone }).phone).toBe(phone)
    expect(ok({ whatsapp: phone }).whatsapp).toBe(phone)
  })

  it.each([
    ['letras', 'llámame'],
    ['texto con número', 'cel 912345678'],
    ['muy corto', '12345'],
    ['más de 15 dígitos', '+56 9 1234 5678 9012 3'],
    ['doble signo', '++56912345678'],
    ['signo al final', '56912345678+'],
    ['inyección', '912345678; drop table places'],
    ['enlace', 'https://wa.me/56912345678'],
    ['demasiado largo', '9 '.repeat(20)],
  ])('teléfono inválido (%s)', (_label, phone) => {
    const r = parse({ phone })
    expect(r.success).toBe(false)
    if (!r.success) expect(firstIssue(r.error)).toMatch(/^Teléfono:/)
  })

  it('el mensaje nombra el campo que falló', () => {
    const r = parse({ whatsapp: 'abc' })
    expect(r.success).toBe(false)
    if (!r.success) expect(firstIssue(r.error)).toMatch(/^WhatsApp:/)
  })

  it.each([
    '@goospe.cl',
    'goospe_cl',
    'https://www.instagram.com/goospe.cl/',
    'instagram.com/goospe',
    'https://instagram.com/goospe?hl=es',
    'HTTPS://INSTAGRAM.COM/Goospe',
  ])('instagram válido: %s', (instagram) => {
    expect(ok({ instagram }).instagram).toBe(instagram)
  })

  it.each([
    ['otro dominio', 'https://evil.com/goospe'],
    ['dominio que imita', 'https://instagram.com.evil.com/goospe'],
    ['espacios', '@mi negocio'],
    ['javascript:', 'javascript:alert(1)'],
    ['usuario de 31 caracteres', 'a'.repeat(31)],
    ['ruta de más', 'instagram.com/goospe/reels'],
    ['html', '<script>alert(1)</script>'],
    ['doble arroba', '@@goospe'],
  ])('instagram inválido (%s)', (_label, instagram) => {
    const r = parse({ instagram })
    expect(r.success).toBe(false)
    if (!r.success) expect(firstIssue(r.error)).toMatch(/^Instagram:/)
  })

  it('sitio web: asume https y solo admite http/https', () => {
    expect(ok({ website: 'goospe.cl' }).website).toBe('https://goospe.cl')
    expect(ok({ website: 'http://goospe.cl/carta' }).website).toBe('http://goospe.cl/carta')
    for (const website of [
      'javascript:alert(1)',
      'ftp://goospe.cl',
      'https://usuario:clave@goospe.cl',
      'localhost',
      'mi sitio.cl',
      'https://',
    ]) {
      expect(parse({ website }).success, website).toBe(false)
    }
  })

  it('precio: solo enteros de 1 a 4', () => {
    expect(ok({ price_level: '3' }).price_level).toBe(3)
    for (const v of ['0', '5', '2.5', 'caro', '', undefined]) {
      expect(ok({ price_level: v }).price_level).toBeNull()
    }
  })

  it('etiquetas: recorta, descarta vacías y limita a 8', () => {
    expect(ok({ tags: ' terraza , ,pet friendly,' }).tags).toEqual(['terraza', 'pet friendly'])
    expect(ok({ tags: 'a,b,c,d,e,f,g,h,i,j' }).tags).toHaveLength(8)
    expect(parse({ tags: 'x'.repeat(41) }).success).toBe(false)
  })

  it('límites de texto', () => {
    expect(parse({ description: 'a'.repeat(2000) }).success).toBe(true)
    expect(parse({ description: 'a'.repeat(2001) }).success).toBe(false)
    expect(parse({ vibe_line: 'a'.repeat(161) }).success).toBe(false)
  })
})

describe('claimSchema', () => {
  it('valida el teléfono de contacto igual que la ficha', () => {
    expect(claimSchema.safeParse({ contact_name: ' Ana ', phone: '+56 9 1234 5678', message: '' }).data).toEqual({
      contact_name: 'Ana', phone: '+56 9 1234 5678', message: null,
    })
    expect(claimSchema.safeParse({ phone: 'no tengo' }).success).toBe(false)
    expect(claimSchema.safeParse({ message: 'a'.repeat(1001) }).success).toBe(false)
  })
})
