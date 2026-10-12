import { createHash, timingSafeEqual } from 'node:crypto'

// Autorización de las rutas /api/cron/*. Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`
// cuando la variable existe en el proyecto. Sin secreto (o con uno corto) TODO se rechaza:
// estas rutas envían emails y gastan IA, así que se falla cerrado.

const MIN_SECRET_CHARS = 16
const digest = (s: string) => createHash('sha256').update(s).digest()

/** True solo si la cabecera trae exactamente el secreto. Comparación en tiempo constante. */
export function isAuthorizedCron(authorization: string | null | undefined, secret: string | null | undefined): boolean {
  const expected = secret?.trim()
  if (!expected || expected.length < MIN_SECRET_CHARS) return false
  if (!authorization?.startsWith('Bearer ')) return false
  // Se comparan los hashes: mismo largo siempre, así ni la longitud del secreto se filtra.
  return timingSafeEqual(digest(authorization.slice(7)), digest(expected))
}
