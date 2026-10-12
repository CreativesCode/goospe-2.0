import { z } from 'zod'

// Validación de lo que el dueño escribe en su ficha y en la solicitud de reclamo.
// Vive fuera de actions/business.ts porque un archivo 'use server' sólo exporta funciones async.

// Campo de formulario → string recortado, o null si viene vacío / no es texto.
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

const optText = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().max(max, `${label}: máximo ${max} caracteres`).nullable())

// Teléfono / WhatsApp: dígitos con separadores habituales, entre 6 y 15 dígitos (E.164).
// Acepta los formatos heredados de OSM que ya están en la base: "(65) 248 2888", "65/233343".
const PHONE_RE = /^[+(]?[0-9(][0-9\s()./-]*$/
const optPhone = (label: string) =>
  z.preprocess(
    blankToNull,
    z.string().max(30, `${label}: demasiado largo`)
      .refine((v) => {
        const digits = v.replace(/\D/g, '').length
        return PHONE_RE.test(v) && digits >= 6 && digits <= 15
      }, `${label}: usa sólo números (puedes incluir + y espacios)`)
      .nullable()
  )

// Sitio web: sólo http/https. Si viene sin esquema se asume https (como hacía la ficha al mostrarlo).
const website = z.preprocess(
  (v) => {
    const s = blankToNull(v)
    if (!s) return null
    return /^https?:\/\//i.test(s) ? s : `https://${s}`
  },
  z.string().max(300, 'Sitio web: demasiado largo')
    .refine((v) => {
      if (/\s/.test(v)) return false
      try {
        const u = new URL(v)
        return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') && !u.username && !u.password
      } catch {
        return false
      }
    }, 'Sitio web: escribe una dirección válida (https://…)')
    .nullable()
)

// Instagram: usuario (@opcional) o URL del perfil en instagram.com (esquema y query opcionales).
const IG_RE = /^(?:@?[A-Za-z0-9._]{1,30}|(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(?:\?[A-Za-z0-9=&_.%-]*)?)$/i
const instagram = z.preprocess(
  blankToNull,
  z.string().max(100, 'Instagram: demasiado largo')
    .regex(IG_RE, 'Instagram: escribe tu usuario (@tunegocio) o el enlace a tu perfil')
    .nullable()
)

const priceLevel = z.preprocess((v) => {
  const n = typeof v === 'string' && v ? Number(v) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null
}, z.number().nullable())

const tags = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) : []),
  z.array(z.string().max(40, 'Etiquetas: cada una puede tener hasta 40 caracteres'))
)

export const listingSchema = z.object({
  description: optText(2000, 'Descripción'),
  vibe_line: optText(160, 'Frase de identidad'),
  phone: optPhone('Teléfono'),
  whatsapp: optPhone('WhatsApp'),
  website,
  instagram,
  price_level: priceLevel,
  tags,
})

export const claimSchema = z.object({
  contact_name: optText(120, 'Nombre'),
  phone: optPhone('Teléfono'),
  message: optText(1000, 'Mensaje'),
})

// Primer error legible (los formularios muestran un único mensaje).
export const firstIssue = (error: z.ZodError): string => error.issues[0]?.message ?? 'Datos inválidos'
