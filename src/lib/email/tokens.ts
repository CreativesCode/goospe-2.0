import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { UUID_RE } from '@/lib/validation'
import { absoluteUrl, linkSecret } from '@/lib/email/config'
import { SUBSCRIBABLE_CATEGORIES, type SubscribableCategory } from '@/lib/email/categories'

// Tokens firmados para enlaces de email (baja / preferencias sin iniciar sesión).
// Formato: v1.<payload base64url>.<HMAC-SHA256 base64url>. No van cifrados: el payload solo
// lleva el id del usuario y la categoría; lo que importa es que no se puede falsificar.
// Sin secreto (EMAIL_LINK_SECRET) no se firma ni se verifica nada: se falla cerrado.

const VERSION = 'v1'
const MAX_TOKEN_CHARS = 1024

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(`${VERSION}.${body}`).digest()

export type TokenPayload = Record<string, unknown>

/** Firma un payload. `expiresInSeconds` opcional: sin él el token no caduca. */
export function signToken(
  payload: TokenPayload, secret: string, opts: { expiresInSeconds?: number; now?: number } = {}
): string {
  if (!secret) throw new Error('signToken: falta el secreto')
  const now = opts.now ?? Date.now()
  const full = opts.expiresInSeconds ? { ...payload, exp: Math.floor(now / 1000) + opts.expiresInSeconds } : payload
  const body = b64url(JSON.stringify(full))
  return `${VERSION}.${body}.${b64url(mac(body, secret))}`
}

/** Payload si la firma es válida y no caducó; null en cualquier otro caso. Nunca lanza. */
export function verifyToken(token: unknown, secret: string | null, now = Date.now()): TokenPayload | null {
  if (!secret || typeof token !== 'string' || token.length > MAX_TOKEN_CHARS) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return null
  const body = parts[1]
  const sig = parts[2]
  try {
    const given = Buffer.from(sig, 'base64url')
    const expected = mac(body, secret)
    // Comparación en tiempo constante; longitudes distintas ya son un no.
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    // Forma canónica: base64url admite variantes del último carácter que decodifican igual.
    if (b64url(given) !== sig) return null
    const payload: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const exp = (payload as { exp?: unknown }).exp
    if (exp !== undefined && (typeof exp !== 'number' || exp * 1000 < now)) return null
    return payload as TokenPayload
  } catch {
    return null
  }
}

// ---- Baja por categoría --------------------------------------------------------------

const unsubscribeSchema = z.object({
  u: z.string().regex(UUID_RE),
  c: z.enum(SUBSCRIBABLE_CATEGORIES),
})

export type UnsubscribeTarget = { userId: string; category: SubscribableCategory }

/** Token de baja (no caduca: el enlace de un email viejo debe seguir sirviendo). Null sin secreto. */
export function unsubscribeToken(t: UnsubscribeTarget, secret: string | null = linkSecret()): string | null {
  return secret ? signToken({ u: t.userId, c: t.category }, secret) : null
}

export function readUnsubscribeToken(token: unknown, secret: string | null = linkSecret()): UnsubscribeTarget | null {
  const parsed = unsubscribeSchema.safeParse(verifyToken(token, secret))
  return parsed.success ? { userId: parsed.data.u, category: parsed.data.c } : null
}

export type UnsubscribeLinks = { page: string; oneClick: string }

/** Enlaces de baja: la página pública y el POST de un clic (cabecera List-Unsubscribe). */
export function unsubscribeLinks(t: UnsubscribeTarget, secret: string | null = linkSecret()): UnsubscribeLinks | null {
  const token = unsubscribeToken(t, secret)
  if (!token) return null
  const q = `?token=${encodeURIComponent(token)}`
  return { page: absoluteUrl(`/unsubscribe${q}`), oneClick: absoluteUrl(`/api/email/unsubscribe${q}`) }
}
