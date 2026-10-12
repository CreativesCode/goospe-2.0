import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decideSend, isSubscribed } from '@/lib/email/categories'

// Base de datos falsa: registra lo que se escribe en email_log y responde lo mínimo.
type Result = { data: unknown; error: { code?: string; message: string } | null }
type Call = { table: string; op: 'insert' | 'update' | 'select'; payload?: Record<string, unknown> }
const db = {
  calls: [] as Call[],
  preferences: [] as { category: string; subscribed: boolean }[],
  insertError: null as Result['error'],
  existing: null as Record<string, unknown> | null,
}

function builder(table: string) {
  let op: Call['op'] = 'select'
  const result = (): Result => {
    if (table === 'email_preferences') return { data: db.preferences, error: null }
    if (op === 'insert') return db.insertError ? { data: null, error: db.insertError } : { data: { id: 1 }, error: null }
    if (op === 'update') return { data: [{ id: 1 }], error: null }
    return { data: db.existing, error: null }
  }
  const b = {
    insert(payload: Record<string, unknown>) { op = 'insert'; db.calls.push({ table, op, payload }); return b },
    update(payload: Record<string, unknown>) { op = 'update'; db.calls.push({ table, op, payload }); return b },
    select() { return b },
    eq() { return b },
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
    then: (resolve: (r: Result) => unknown) => Promise.resolve(result()).then(resolve),
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => builder(table) }) }))

const { buildResendRequest, canRetry, isEmailAddress, sendEmail, MAX_ATTEMPTS } = await import('@/lib/email/send')

const USER = '0b0f8a52-6d0c-4a43-9c57-3f1f0a1f2a10'
const content = { subject: 'Hola', html: '<p>Hola</p>', text: 'Hola' }
const fetchMock = vi.fn()
const lastStatus = () => db.calls.filter((c) => c.table === 'email_log' && c.op === 'update').at(-1)?.payload?.status

beforeEach(() => {
  db.calls = []; db.preferences = []; db.insertError = null; db.existing = null
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('EMAIL_FROM', '')
  vi.stubEnv('EMAIL_LINK_SECRET', 'un-secreto-de-prueba-de-al-menos-32-caracteres')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://goospe.vercel.app')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const withProvider = () => { vi.stubEnv('RESEND_API_KEY', 're_test'); vi.stubEnv('EMAIL_FROM', 'Goospe <hola@goospe.cl>') }

describe('preferencias', () => {
  it('sin fila = suscrito; la fila manda; lo transaccional siempre', () => {
    expect(isSubscribed([], 'weekly_report')).toBe(true)
    expect(isSubscribed([{ category: 'weekly_report', subscribed: false }], 'weekly_report')).toBe(false)
    expect(isSubscribed([{ category: 'weekly_report', subscribed: false }], 'alerts')).toBe(true)
    expect(isSubscribed([{ category: 'alerts', subscribed: true }], 'alerts')).toBe(true)
    expect(isSubscribed([{ category: 'transactional', subscribed: false }], 'transactional')).toBe(true)
  })

  it('decideSend: la baja va antes que el proveedor, y sin secreto no sale nada con baja', () => {
    const base = { subscribed: true, hasProvider: true, hasLinkSecret: true }
    expect(decideSend({ ...base, category: 'alerts' })).toBe('send')
    expect(decideSend({ ...base, category: 'alerts', subscribed: false })).toBe('skipped_unsubscribed')
    expect(decideSend({ ...base, category: 'alerts', subscribed: false, hasProvider: false })).toBe('skipped_unsubscribed')
    expect(decideSend({ ...base, category: 'alerts', hasProvider: false })).toBe('skipped_no_provider')
    expect(decideSend({ ...base, category: 'alerts', hasLinkSecret: false })).toBe('failed_no_link_secret')
    expect(decideSend({ ...base, category: 'transactional', subscribed: false, hasLinkSecret: false })).toBe('send')
    expect(decideSend({ ...base, category: 'transactional', hasProvider: false })).toBe('skipped_no_provider')
  })
})

describe('sendEmail', () => {
  it('sin proveedor: no llama a nadie y queda registrado como omitido', async () => {
    const res = await sendEmail({ to: 'ana@example.com', template: 'claim_approved', category: 'transactional', dedupeKey: 'k1', render: () => content })
    expect(res.status).toBe('skipped_no_provider')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.calls[0]).toMatchObject({ table: 'email_log', op: 'insert', payload: { to_email: 'ana@example.com', status: 'queued', dedupe_key: 'k1' } })
    expect(lastStatus()).toBe('skipped_no_provider')
  })

  it('con solo la llave (sin remitente) tampoco envía', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    const res = await sendEmail({ to: 'ana@example.com', template: 't', category: 'transactional', render: () => content })
    expect(res.status).toBe('skipped_no_provider')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('respeta la baja aunque haya proveedor', async () => {
    withProvider()
    db.preferences = [{ category: 'weekly_report', subscribed: false }]
    const res = await sendEmail({ to: 'ana@example.com', userId: USER, template: 'weekly_report', category: 'weekly_report', render: () => content })
    expect(res.status).toBe('skipped_unsubscribed')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(lastStatus()).toBe('skipped_unsubscribed')
  })

  it('lo transaccional ignora las preferencias', async () => {
    withProvider()
    db.preferences = [{ category: 'alerts', subscribed: false }, { category: 'weekly_report', subscribed: false }]
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }))
    const res = await sendEmail({ to: 'ana@example.com', userId: USER, template: 'claim_rejected', category: 'transactional', render: () => content })
    expect(res.status).toBe('sent')
    expect(lastStatus()).toBe('sent')
  })

  it('envía con baja de un clic e idempotencia, y pasa el enlace de baja a la plantilla', async () => {
    withProvider()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }))
    const render = vi.fn(() => content)
    const res = await sendEmail({ to: 'ana@example.com', userId: USER, template: 'review_critical', category: 'alerts', dedupeKey: 'review_critical:n1', render })
    expect(res.status).toBe('sent')
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }]
    const body = JSON.parse(init.body) as { from: string; to: string[]; headers: Record<string, string> }
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    expect(init.headers['Idempotency-Key']).toBe('review_critical:n1')
    expect(body.to).toEqual(['ana@example.com'])
    expect(body.headers['List-Unsubscribe']).toMatch(/^<https:\/\/goospe\.vercel\.app\/api\/email\/unsubscribe\?token=.+>$/)
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(render).toHaveBeenCalledWith({ unsubscribeUrl: expect.stringMatching(/^https:\/\/goospe\.vercel\.app\/unsubscribe\?token=/) })
  })

  it('sin EMAIL_LINK_SECRET un email con baja no sale', async () => {
    withProvider()
    vi.stubEnv('EMAIL_LINK_SECRET', '')
    const res = await sendEmail({ to: 'ana@example.com', userId: USER, template: 'weekly_report', category: 'weekly_report', render: () => content })
    expect(res.status).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un error del proveedor no lanza y queda como fallido', async () => {
    withProvider()
    fetchMock.mockResolvedValue(new Response('{"message":"Domain not verified"}', { status: 403 }))
    const res = await sendEmail({ to: 'ana@example.com', template: 't', category: 'transactional', render: () => content })
    expect(res.status).toBe('failed')
    expect(res.error).toContain('403')
    expect(lastStatus()).toBe('failed')

    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(sendEmail({ to: 'ana@example.com', template: 't', category: 'transactional', render: () => content })).resolves.toMatchObject({ status: 'failed' })
  })

  it('la misma clave ya enviada no vuelve a salir', async () => {
    withProvider()
    db.insertError = { code: '23505', message: 'duplicate key' }
    db.existing = { id: 7, status: 'sent', attempts: 1, updated_at: new Date().toISOString() }
    const res = await sendEmail({ to: 'ana@example.com', template: 't', category: 'transactional', dedupeKey: 'k', render: () => content })
    expect(res.status).toBe('duplicate')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si el registro no está disponible no envía (sin registro no hay idempotencia)', async () => {
    withProvider()
    db.insertError = { code: '42P01', message: 'relation "email_log" does not exist' }
    const res = await sendEmail({ to: 'ana@example.com', template: 't', category: 'transactional', render: () => content })
    expect(res.status).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza destinatarios inválidos y avisos con baja sin usuario', async () => {
    expect((await sendEmail({ to: 'no-es-email', template: 't', category: 'transactional', render: () => content })).status).toBe('failed')
    expect((await sendEmail({ to: 'ana@example.com', template: 't', category: 'alerts', render: () => content })).status).toBe('failed')
    expect(db.calls).toHaveLength(0)
  })
})

describe('reintentos y petición', () => {
  it('canRetry: nunca tras enviado o baja; sí tras fallo u omisión, hasta el tope', () => {
    const now = Date.now()
    const row = (status: string, attempts = 1, ageMs = 0) => ({ status, attempts, updated_at: new Date(now - ageMs).toISOString() })
    expect(canRetry(row('sent'), now)).toBe(false)
    expect(canRetry(row('skipped_unsubscribed'), now)).toBe(false)
    expect(canRetry(row('failed'), now)).toBe(true)
    expect(canRetry(row('skipped_no_provider'), now)).toBe(true)
    expect(canRetry(row('failed', MAX_ATTEMPTS), now)).toBe(false)
    expect(canRetry(row('queued', 1, 60_000), now)).toBe(false) // en curso
    expect(canRetry(row('queued', 1, 16 * 60_000), now)).toBe(true) // murió a mitad
  })

  it('buildResendRequest: lo transaccional no lleva List-Unsubscribe', () => {
    const req = buildResendRequest({ apiKey: 'k', from: 'Goospe <a@b.cl>', replyTo: 'hola@b.cl' }, { to: 'x@y.cl', content, unsubscribe: null, template: 'claim_new_team', category: 'transactional' })
    const body = JSON.parse(req.init.body) as Record<string, unknown>
    expect(body.headers).toBeUndefined()
    expect(body.reply_to).toBe('hola@b.cl')
    expect(req.init.headers['Idempotency-Key']).toBeUndefined()
  })

  it('isEmailAddress', () => {
    expect(isEmailAddress('ana@example.com')).toBe(true)
    for (const bad of ['', 'ana', 'ana@', 'a b@c.d', 'a@b.c, x@y.z', 'a@b.c\nBcc: x@y.z', null, undefined]) expect(isEmailAddress(bad)).toBe(false)
  })
})
