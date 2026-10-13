import { z } from 'zod'
import { containsProfanity } from '@/lib/profanity'

// Validación del perfil editable y de los cambios de email / contraseña. Fuera de los
// archivos 'use server' porque esos solo pueden exportar funciones async.
export const NAME_MIN = 2
export const NAME_MAX = 60
export const MIN_AGE = 13
export const OLDEST_BIRTH_YEAR = 1900

const FORBIDDEN_IN_NAME = /[<>]|\p{Cc}/u
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Último año de nacimiento admitido (edad mínima de uso). */
export const latestBirthYear = (now: Date = new Date()) => now.getUTCFullYear() - MIN_AGE

export function profileSchema(now: Date = new Date()) {
  const latest = latestBirthYear(now)
  return z.object({
    display_name: z.preprocess(
      trimmed,
      z.string()
        .min(NAME_MIN, `Tu nombre necesita al menos ${NAME_MIN} letras`)
        .max(NAME_MAX, `Tu nombre no puede pasar de ${NAME_MAX} caracteres`)
        .refine((v) => !FORBIDDEN_IN_NAME.test(v), 'Tu nombre tiene caracteres no permitidos')
        .refine((v) => !containsProfanity(v), 'Elige un nombre sin lenguaje ofensivo')
    ),
    home_city_id: z.preprocess(
      blankToNull,
      z.coerce.number({ message: 'Ciudad inválida' }).int('Ciudad inválida').positive('Ciudad inválida').nullable()
    ),
    birth_year: z.preprocess(
      blankToNull,
      z.coerce.number({ message: 'Escribe el año con 4 cifras' })
        .int('Escribe el año con 4 cifras')
        .min(OLDEST_BIRTH_YEAR, 'Revisa tu año de nacimiento')
        .max(latest, `Debes tener al menos ${MIN_AGE} años para usar Goospe`)
        .nullable()
    ),
  })
}
export type ProfileInput = z.infer<ReturnType<typeof profileSchema>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  z.string().max(254, 'Email demasiado largo').regex(EMAIL_RE, 'Escribe un email válido')
)
// La contraseña ACTUAL no se valida contra la política vigente: una cuenta antigua puede tener otra.
const currentPassword = z.preprocess(
  (v) => (typeof v === 'string' ? v : ''),
  z.string().min(1, 'Escribe tu contraseña actual').max(200, 'Contraseña inválida')
)
const newPassword = z.preprocess(
  (v) => (typeof v === 'string' ? v : ''),
  z.string().min(6, 'La contraseña nueva debe tener al menos 6 caracteres').max(72, 'La contraseña nueva es demasiado larga')
)

export const changePasswordSchema = z
  .object({ current_password: currentPassword, new_password: newPassword })
  .refine((v) => v.current_password !== v.new_password, {
    message: 'La contraseña nueva debe ser distinta de la actual', path: ['new_password'],
  })

export const changeEmailSchema = z.object({ current_password: currentPassword, email })

export const deleteAccountSchema = z.object({
  current_password: currentPassword,
  confirmation: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().max(40)),
})

export const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Revisa los datos e intenta de nuevo.'
