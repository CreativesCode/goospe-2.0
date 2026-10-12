import { z } from 'zod'
import { listingSchema } from '@/features/business/listing-schema'
import { hoursInputSchema, parseHoursField } from '@/lib/hours-editor'
import { containsProfanity } from '@/lib/profanity'

// Validación de lo que el dueño (y el admin, al resolver) escribe en la fase 5 del panel.
// Fuera de los archivos 'use server' porque esos solo pueden exportar funciones async.

const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const optText = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().max(max, `${label}: máximo ${max} caracteres`).nullable())

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MAX_CATEGORIES = 3
export const REPLY_MAX = 1000
export const BRAND_VOICE_MAX = 500
export const REASON_MAX = 500

const categoryIds = z.preprocess(
  (v) => (typeof v === 'string' ? [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean).map(Number))] : []),
  z.array(z.number().int().positive())
    .min(1, 'Elige al menos una categoría')
    .max(MAX_CATEGORIES, `Elige hasta ${MAX_CATEGORIES} categorías`)
)

/** Ficha completa del dueño = campos de siempre + email, dirección, categorías y horario. */
export const ownerListingSchema = listingSchema.extend({
  email: z.preprocess(
    blankToNull,
    z.string().max(160, 'Email: demasiado largo').regex(EMAIL_RE, 'Email: escribe una dirección válida').nullable()
  ),
  street: optText(120, 'Calle'),
  street_number: optText(20, 'Número'),
  category_ids: categoryIds,
  // Sin el campo no se toca el horario guardado (el editor solo lo envía si el dueño lo cambió).
  hours: z.preprocess(parseHoursField, hoursInputSchema.optional()),
})

export type PlaceAddress = { street?: string | null; number?: string | null; city?: string | null; formatted?: string | null }

/** Dirección jsonb de places: conserva ciudad y demás claves, recalcula `formatted`. */
export function buildAddress(prev: PlaceAddress | null, street: string | null, number: string | null): PlaceAddress | null {
  const formatted = [street, number].filter(Boolean).join(' ') || null
  if (!prev && !formatted) return null
  return { ...(prev ?? {}), street, number, formatted }
}

const clean = (max: number, min: number, label: string) =>
  z.preprocess(
    trimmed,
    z.string()
      .min(min, `${label}: escribe al menos ${min} caracteres`)
      .max(max, `${label}: máximo ${max} caracteres`)
      .refine((v) => !containsProfanity(v), `${label}: evita lenguaje ofensivo`)
  )

/** Respuesta pública del negocio a una reseña. */
export const reviewReplySchema = z.object({ body: clean(REPLY_MAX, 2, 'Respuesta') })

/** Tono de marca que lee la IA (vacío = quitarlo). */
export const brandVoiceSchema = z.object({
  brand_voice: z.preprocess(
    blankToNull,
    z.string().max(BRAND_VOICE_MAX, `Tono de marca: máximo ${BRAND_VOICE_MAX} caracteres`)
      .refine((v) => !containsProfanity(v), 'Tono de marca: evita lenguaje ofensivo').nullable()
  ),
})

/** Motivo obligatorio al rechazar un reclamo o una solicitud de cambio. */
export const rejectReasonSchema = z.object({ reason: clean(REASON_MAX, 5, 'Motivo') })

/** Solicitud de cambio de nombre o de ubicación (la resuelve un admin). */
export const changeRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('name'),
    name: clean(120, 2, 'Nombre'),
    message: optText(1000, 'Mensaje'),
  }),
  z.object({
    kind: z.literal('location'),
    reference: clean(500, 5, 'Ubicación'),
    message: optText(1000, 'Mensaje'),
  }),
])

/** Motivo opcional al cancelar un evento (se incluye en el aviso a los inscritos). */
export const cancelEventSchema = z.object({ reason: optText(300, 'Motivo') })
