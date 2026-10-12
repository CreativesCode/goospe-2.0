import { afterEach, describe, expect, it, vi } from 'vitest'
import { readUnsubscribeToken, signToken, unsubscribeLinks, unsubscribeToken, verifyToken } from '@/lib/email/tokens'

const SECRET = 'un-secreto-de-prueba-de-al-menos-32-caracteres'
const USER = '0b0f8a52-6d0c-4a43-9c57-3f1f0a1f2a10'

afterEach(() => vi.unstubAllEnvs())

describe('signToken / verifyToken', () => {
  it('verifica lo que firmó', () => {
    const token = signToken({ u: USER, c: 'alerts' }, SECRET)
    expect(verifyToken(token, SECRET)).toEqual({ u: USER, c: 'alerts' })
  })

  it('rechaza un payload manipulado', () => {
    const [v, , sig] = signToken({ u: USER, c: 'alerts' }, SECRET).split('.')
    const forged = Buffer.from(JSON.stringify({ u: USER, c: 'weekly_report' })).toString('base64url')
    expect(verifyToken(`${v}.${forged}.${sig}`, SECRET)).toBeNull()
  })

  it('rechaza una firma manipulada o de otro secreto', () => {
    const token = signToken({ u: USER }, SECRET)
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    expect(verifyToken(flipped, SECRET)).toBeNull()
    expect(verifyToken(token, 'otro-secreto-distinto-de-al-menos-32-caracteres')).toBeNull()
  })

  it('falla cerrado sin secreto', () => {
    const token = signToken({ u: USER }, SECRET)
    expect(verifyToken(token, null)).toBeNull()
    expect(verifyToken(token, '')).toBeNull()
    expect(() => signToken({ u: USER }, '')).toThrow()
  })

  it.each([
    ['vacío', ''],
    ['sin partes', 'abc'],
    ['otra versión', 'v2.abc.def'],
    ['cuatro partes', 'v1.a.b.c'],
    ['no es texto', 42],
    ['null', null],
    ['desmesurado', `v1.${'a'.repeat(2000)}.b`],
  ])('rechaza un token mal formado: %s', (_label, token) => {
    expect(verifyToken(token, SECRET)).toBeNull()
  })

  it('respeta la caducidad cuando se pide', () => {
    const now = Date.UTC(2026, 9, 12)
    const token = signToken({ u: USER }, SECRET, { expiresInSeconds: 60, now })
    expect(verifyToken(token, SECRET, now + 59_000)).toMatchObject({ u: USER })
    expect(verifyToken(token, SECRET, now + 61_000)).toBeNull()
  })

  it('sin caducidad no vence', () => {
    const token = signToken({ u: USER }, SECRET, { now: 0 })
    expect(verifyToken(token, SECRET, Date.UTC(2040, 0, 1))).toEqual({ u: USER })
  })
})

describe('token de baja', () => {
  it('ida y vuelta', () => {
    const token = unsubscribeToken({ userId: USER, category: 'weekly_report' }, SECRET)
    expect(readUnsubscribeToken(token, SECRET)).toEqual({ userId: USER, category: 'weekly_report' })
  })

  it('no acepta un token firmado con otra forma de payload', () => {
    expect(readUnsubscribeToken(signToken({ u: 'no-es-uuid', c: 'alerts' }, SECRET), SECRET)).toBeNull()
    expect(readUnsubscribeToken(signToken({ u: USER, c: 'transactional' }, SECRET), SECRET)).toBeNull()
    expect(readUnsubscribeToken(signToken({ u: USER }, SECRET), SECRET)).toBeNull()
  })

  it('sin EMAIL_LINK_SECRET no firma ni verifica', () => {
    vi.stubEnv('EMAIL_LINK_SECRET', '')
    expect(unsubscribeToken({ userId: USER, category: 'alerts' })).toBeNull()
    expect(unsubscribeLinks({ userId: USER, category: 'alerts' })).toBeNull()
    expect(readUnsubscribeToken(unsubscribeToken({ userId: USER, category: 'alerts' }, SECRET))).toBeNull()
  })

  it('un secreto corto cuenta como ausente', () => {
    vi.stubEnv('EMAIL_LINK_SECRET', 'corto')
    expect(unsubscribeToken({ userId: USER, category: 'alerts' })).toBeNull()
  })

  it('arma la página y el POST de un clic con el mismo token', () => {
    vi.stubEnv('EMAIL_LINK_SECRET', SECRET)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://goospe.vercel.app/')
    const links = unsubscribeLinks({ userId: USER, category: 'digest' })
    expect(links?.page.startsWith('https://goospe.vercel.app/unsubscribe?token=')).toBe(true)
    expect(links?.oneClick.startsWith('https://goospe.vercel.app/api/email/unsubscribe?token=')).toBe(true)
    const token = new URL(links!.page).searchParams.get('token')
    expect(new URL(links!.oneClick).searchParams.get('token')).toBe(token)
    expect(readUnsubscribeToken(token)).toEqual({ userId: USER, category: 'digest' })
  })
})
