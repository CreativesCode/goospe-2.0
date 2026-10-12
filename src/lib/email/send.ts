import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import type { EmailContent } from '@/emails/layout'
import { emailProvider, linkSecret, type EmailProvider } from '@/lib/email/config'
import { decideSend, type EmailCategory, type SubscribableCategory } from '@/lib/email/categories'
import { loadPreferences } from '@/lib/email/preferences'
import { unsubscribeLinks, type UnsubscribeLinks } from '@/lib/email/tokens'

// Envío de email por la API REST de Resend (fetch, sin dependencia). Reglas:
//   · NUNCA lanza: un email es secundario; el resultado vuelve como estado.
//   · Cada intento deja una fila en email_log (sent | skipped_no_provider |
//     skipped_unsubscribed | failed). La fila se crea ANTES de llamar al proveedor en estado
//     'queued': con dedupe_key (índice único) hace de candado, así que dos llamadas con la
//     misma clave no envían dos veces aunque corran a la vez.
//   · Sin RESEND_API_KEY + EMAIL_FROM no se llama a nadie: queda 'skipped_no_provider'.
//   · Lo no transaccional respeta la baja por categoría y lleva List-Unsubscribe de un clic.

type Admin = ReturnType<typeof createAdminClient>

export type SendStatus = 'sent' | 'skipped_no_provider' | 'skipped_unsubscribed' | 'failed' | 'duplicate'
export type SendResult = { status: SendStatus; error?: string }

export type SendInput = {
  to: string
  /** Obligatorio en lo no transaccional (preferencias y enlace de baja van por usuario). */
  userId?: string | null
  /** Nombre de la plantilla, para el registro (claim_approved, weekly_report…). */
  template: string
  category: EmailCategory
  /** Recibe el enlace de baja (null en lo transaccional) y devuelve el contenido. */
  render: (links: { unsubscribeUrl: string | null }) => EmailContent
  /** Clave de idempotencia: el mismo aviso no sale dos veces. Máx. 256 caracteres. */
  dedupeKey?: string
  meta?: Record<string, Json>
}

const RESEND_URL = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 10_000
/** Reintentos de una misma clave que no llegó a enviarse (falló o no había proveedor). */
export const MAX_ATTEMPTS = 3
/** Una fila 'queued' más nueva que esto es un envío en curso: no se pisa. */
const IN_FLIGHT_MS = 15 * 60_000
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

export const isEmailAddress = (v: unknown): v is string => typeof v === 'string' && v.length <= 320 && EMAIL_RE.test(v)

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s)

export type ResendRequest = { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } }

/** Petición a Resend. Pura: se prueba sin red. */
export function buildResendRequest(
  provider: EmailProvider,
  mail: { to: string; content: EmailContent; unsubscribe: UnsubscribeLinks | null; dedupeKey?: string; template: string; category: string }
): ResendRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  }
  // Resend deduplica 24 h por esta cabecera: cubre el reintento tras un timeout nuestro.
  if (mail.dedupeKey) headers['Idempotency-Key'] = clip(mail.dedupeKey, 256)
  const body = {
    from: provider.from,
    to: [mail.to],
    subject: mail.content.subject,
    html: mail.content.html,
    text: mail.content.text,
    ...(provider.replyTo ? { reply_to: provider.replyTo } : {}),
    // RFC 8058: baja de un clic (Gmail y Yahoo la exigen en correo no transaccional).
    ...(mail.unsubscribe
      ? { headers: { 'List-Unsubscribe': `<${mail.unsubscribe.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
      : {}),
    tags: [{ name: 'template', value: mail.template.replace(/[^a-zA-Z0-9_-]/g, '_') }, { name: 'category', value: mail.category }],
  }
  return { url: RESEND_URL, init: { method: 'POST', headers, body: JSON.stringify(body) } }
}

type LogRow = { id: number; status: string; attempts: number; updated_at: string }

/** Decide si una fila ya existente con la misma clave se puede reintentar. Pura. */
export function canRetry(row: Pick<LogRow, 'status' | 'attempts' | 'updated_at'>, now = Date.now()): boolean {
  if (row.status === 'sent' || row.status === 'skipped_unsubscribed') return false
  if (row.attempts >= MAX_ATTEMPTS) return false
  if (row.status === 'queued') return now - new Date(row.updated_at).getTime() > IN_FLIGHT_MS
  return true // failed | skipped_no_provider
}

// Toma el candado del envío. Devuelve el id de la fila, 'duplicate' si otro ya lo envió o lo
// está enviando, o null si el registro no está disponible (entonces NO se envía: sin registro
// no hay idempotencia ni rastro).
async function claim(admin: Admin, input: SendInput): Promise<number | 'duplicate' | null> {
  const row = {
    user_id: input.userId ?? null,
    to_email: clip(input.to, 320),
    template: clip(input.template, 60),
    category: input.category,
    status: 'queued',
    dedupe_key: input.dedupeKey ? clip(input.dedupeKey, 256) : null,
    meta: (input.meta ?? {}) as Json,
  }
  const { data, error } = await admin.from('email_log').insert(row).select('id').single()
  if (data) return data.id
  if (error?.code !== '23505' || !row.dedupe_key) {
    console.error(`[email] registro no disponible (${input.template}):`, error?.message)
    return null
  }

  const { data: prev } = await admin.from('email_log')
    .select('id, status, attempts, updated_at').eq('dedupe_key', row.dedupe_key).maybeSingle()
  const existing = prev as LogRow | null
  if (!existing || !canRetry(existing)) return 'duplicate'
  // Reintento: el filtro por estado e intentos va en el UPDATE; si otro proceso ganó, no hay fila.
  const { data: won } = await admin.from('email_log')
    .update({ status: 'queued', attempts: existing.attempts + 1, updated_at: new Date().toISOString(), error: null })
    .eq('id', existing.id).eq('status', existing.status).eq('attempts', existing.attempts).select('id')
  return won?.length ? existing.id : 'duplicate'
}

async function finish(
  admin: Admin, id: number,
  patch: { status: Exclude<SendStatus, 'duplicate'>; subject?: string; provider_id?: string | null; error?: string | null }
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin.from('email_log').update({
    status: patch.status,
    subject: patch.subject ? clip(patch.subject, 200) : null,
    provider: patch.status === 'sent' || patch.status === 'failed' ? 'resend' : null,
    provider_id: patch.provider_id ?? null,
    error: patch.error ? clip(patch.error, 500) : null,
    sent_at: patch.status === 'sent' ? now : null,
    updated_at: now,
  }).eq('id', id)
  if (error) console.error('[email] no se pudo cerrar el registro:', error.message)
}

async function deliver(req: ResendRequest): Promise<{ id: string | null; error: string | null }> {
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) })
    const raw = await res.text()
    if (!res.ok) return { id: null, error: `Resend ${res.status}: ${raw.slice(0, 300)}` }
    let id: string | null = null
    try {
      const parsed: unknown = JSON.parse(raw)
      const value = (parsed as { id?: unknown } | null)?.id
      id = typeof value === 'string' ? value : null
    } catch { /* 2xx sin JSON: enviado igual */ }
    return { id, error: null }
  } catch (e) {
    return { id: null, error: `Resend: ${(e as Error).message}` }
  }
}

/** Envía un email. Nunca lanza; el resultado dice qué pasó. */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  try {
    if (!isEmailAddress(input.to)) return { status: 'failed', error: 'destinatario inválido' }
    const transactional = input.category === 'transactional'
    if (!transactional && !input.userId) return { status: 'failed', error: 'falta el usuario para un email con baja' }

    const admin = createAdminClient()
    const claimed = await claim(admin, input)
    if (claimed === 'duplicate') return { status: 'duplicate' }
    if (claimed === null) return { status: 'failed', error: 'registro de envíos no disponible' }

    // Preferencias: si no se pueden leer, lo no transaccional no sale (se falla cerrado).
    let subscribed = true
    if (!transactional) {
      const prefs = await loadPreferences(input.userId!, admin)
      if (!prefs) {
        await finish(admin, claimed, { status: 'failed', error: 'preferencias no disponibles' })
        return { status: 'failed', error: 'preferencias no disponibles' }
      }
      subscribed = prefs[input.category as SubscribableCategory]
    }

    const provider = emailProvider()
    const links = transactional ? null : unsubscribeLinks({ userId: input.userId!, category: input.category as SubscribableCategory })
    const decision = decideSend({ category: input.category, subscribed, hasProvider: !!provider, hasLinkSecret: !!linkSecret() })

    if (decision === 'skipped_unsubscribed' || decision === 'skipped_no_provider') {
      await finish(admin, claimed, { status: decision })
      return { status: decision }
    }
    if (decision === 'failed_no_link_secret' || !provider) {
      const error = 'falta EMAIL_LINK_SECRET: no se puede firmar el enlace de baja'
      await finish(admin, claimed, { status: 'failed', error })
      return { status: 'failed', error }
    }

    const content = input.render({ unsubscribeUrl: links?.page ?? null })
    const req = buildResendRequest(provider, {
      to: input.to, content, unsubscribe: links, dedupeKey: input.dedupeKey, template: input.template, category: input.category,
    })
    const sent = await deliver(req)
    if (sent.error) {
      console.error(`[email] ${input.template}:`, sent.error)
      await finish(admin, claimed, { status: 'failed', subject: content.subject, error: sent.error })
      return { status: 'failed', error: sent.error }
    }
    await finish(admin, claimed, { status: 'sent', subject: content.subject, provider_id: sent.id })
    return { status: 'sent' }
  } catch (e) {
    console.error(`[email] ${input.template}:`, (e as Error).message)
    return { status: 'failed', error: (e as Error).message }
  }
}
