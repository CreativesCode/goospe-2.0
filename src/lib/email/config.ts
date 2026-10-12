// Configuración de email leída del entorno EN CADA LLAMADA (no al cargar el módulo): así el
// envío empieza en cuanto se definen las variables y los tests pueden cambiarlas.

const PROD_URL = 'https://goospe.vercel.app'

/** Origen público del sitio para los enlaces de los emails (misma variable que usa el resto). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || PROD_URL
}

/** Ruta interna → URL absoluta. Solo acepta rutas que empiezan por una sola "/". */
export function absoluteUrl(path: string): string {
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  return `${siteUrl()}${safe}`
}

export type EmailProvider = { apiKey: string; from: string; replyTo: string | null }

/** Proveedor (Resend) solo si están la llave Y el remitente; si falta algo, no se envía nada. */
export function emailProvider(): EmailProvider | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!apiKey || !from) return null
  return { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO?.trim() || null }
}

const MIN_SECRET_CHARS = 32

/** Secreto para firmar enlaces de email. Null si falta o es demasiado corto (se falla cerrado). */
export function linkSecret(): string | null {
  const s = process.env.EMAIL_LINK_SECRET?.trim()
  return s && s.length >= MIN_SECRET_CHARS ? s : null
}
