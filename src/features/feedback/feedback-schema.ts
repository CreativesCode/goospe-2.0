import { z } from 'zod'
import { containsProfanity } from '@/lib/profanity'
import { UUID_RE } from '@/lib/validation'

// Feedback general y "sugerir corrección" de un lugar (tabla feedback, 0042). Las categorías
// y los topes coinciden con los CHECK de la tabla: cambiar uno obliga a cambiar el otro.
export const GENERAL_CATEGORIES = ['bug', 'idea', 'content', 'account', 'other'] as const
export const CORRECTION_CATEGORIES = ['hours', 'closed', 'location', 'duplicate', 'info', 'other'] as const
export type GeneralCategory = (typeof GENERAL_CATEGORIES)[number]
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]
export type FeedbackKind = 'general' | 'correction'
export type FeedbackStatus = 'open' | 'resolved' | 'dismissed'

export const GENERAL_LABELS: Record<GeneralCategory, string> = {
  bug: 'Algo no funciona',
  idea: 'Tengo una idea',
  content: 'Contenido incorrecto u ofensivo',
  account: 'Mi cuenta',
  other: 'Otro',
}
export const CORRECTION_LABELS: Record<CorrectionCategory, string> = {
  hours: 'El horario está mal',
  closed: 'Cerró definitivamente',
  location: 'El pin del mapa está mal',
  duplicate: 'Está duplicado',
  info: 'Teléfono, dirección u otro dato está mal',
  other: 'Otro',
}
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Abierto', resolved: 'Resuelto', dismissed: 'Descartado',
}

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 1000
export const NOTE_MIN = 5
export const ADMIN_NOTE_MAX = 500
/** Correcciones que no se entienden sin una explicación. */
export const NOTE_REQUIRED: readonly CorrectionCategory[] = ['duplicate', 'info', 'other']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const clean = (v: string | null) => !containsProfanity(v)

/** Ruta interna desde la que se envió (para reproducir un fallo). Lo que no lo sea se descarta. */
const page = z.preprocess(
  (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && v.length <= 300 ? v : null),
  z.string().nullable()
)

export const generalFeedbackSchema = z.object({
  kind: z.literal('general'),
  category: z.enum(GENERAL_CATEGORIES, { message: 'Elige de qué se trata' }),
  message: z.preprocess(
    trimmed,
    z.string()
      .min(MESSAGE_MIN, `Cuéntanos un poco más (mínimo ${MESSAGE_MIN} caracteres)`)
      .max(MESSAGE_MAX, `Máximo ${MESSAGE_MAX} caracteres`)
      .refine(clean, 'Evita lenguaje ofensivo en tu mensaje')
  ),
  contact_email: z.preprocess(
    blankToNull,
    z.string().max(254, 'Email demasiado largo').regex(EMAIL_RE, 'Escribe un email válido').nullable()
  ),
  page,
})

export const correctionSchema = z
  .object({
    kind: z.literal('correction'),
    place_id: z.string().regex(UUID_RE, 'Lugar inválido'),
    category: z.enum(CORRECTION_CATEGORIES, { message: 'Elige qué está mal' }),
    message: z.preprocess(
      blankToNull,
      z.string().max(MESSAGE_MAX, `Máximo ${MESSAGE_MAX} caracteres`).refine(clean, 'Evita lenguaje ofensivo en tu mensaje').nullable()
    ),
    page,
  })
  .refine(
    (v) => !NOTE_REQUIRED.includes(v.category) || (v.message?.length ?? 0) >= NOTE_MIN,
    { message: 'Cuéntanos qué está mal para poder corregirlo', path: ['message'] }
  )

export type GeneralFeedbackInput = z.infer<typeof generalFeedbackSchema>
export type CorrectionInput = z.infer<typeof correctionSchema>

/** Resolución del admin: resolver o descartar, con nota interna opcional. */
export const resolveFeedbackSchema = z.object({
  feedback_id: z.string().regex(UUID_RE),
  decision: z.enum(['resolved', 'dismissed']),
  note: z.preprocess(blankToNull, z.string().max(ADMIN_NOTE_MAX, `Máximo ${ADMIN_NOTE_MAX} caracteres`).nullable()),
})

export const categoryLabel = (kind: string, category: string): string =>
  (kind === 'correction'
    ? CORRECTION_LABELS[category as CorrectionCategory]
    : GENERAL_LABELS[category as GeneralCategory]) ?? category

export const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Revisa los datos e intenta de nuevo.'
