// Mensajes de Supabase Auth en español, por `error.code` (estable entre versiones; el
// `message` viene en inglés y cambia). Lo desconocido cae a un genérico: nunca se muestra
// el texto crudo del proveedor.
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Aún no confirmas tu email. Revisa tu correo y abre el enlace que te enviamos.',
  user_already_exists: 'Ya existe una cuenta con ese email. Prueba a entrar o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con ese email. Prueba a entrar o recupera tu contraseña.',
  weak_password: 'La contraseña es muy débil. Usa al menos 6 caracteres y evita las más comunes.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  email_address_invalid: 'Ese email no es válido.',
  email_address_not_authorized: 'No podemos enviar correos a esa dirección.',
  validation_failed: 'Revisa los datos e intenta de nuevo.',
  signup_disabled: 'El registro está desactivado por ahora.',
  email_provider_disabled: 'El registro con email está desactivado por ahora.',
  user_banned: 'Esta cuenta está suspendida.',
  user_not_found: 'No encontramos una cuenta con esos datos.',
  over_email_send_rate_limit: 'Enviamos demasiados correos seguidos. Espera unos minutos e intenta de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  otp_expired: 'El enlace expiró o ya fue usado. Pide uno nuevo.',
  otp_disabled: 'Ese enlace ya no es válido. Pide uno nuevo.',
  flow_state_expired: 'El enlace expiró. Pide uno nuevo.',
  flow_state_not_found: 'El enlace no es válido en este navegador. Ábrelo en el mismo donde lo pediste.',
  bad_code_verifier: 'El enlace no es válido en este navegador. Ábrelo en el mismo donde lo pediste.',
  session_not_found: 'Tu sesión expiró. Vuelve a entrar.',
  session_expired: 'Tu sesión expiró. Vuelve a entrar.',
  refresh_token_not_found: 'Tu sesión expiró. Vuelve a entrar.',
  request_timeout: 'El servicio tardó demasiado. Intenta de nuevo.',
}

export const AUTH_GENERIC_ERROR = 'No pudimos completar la operación. Intenta de nuevo.'

type AuthLikeError = { code?: string | null; status?: number | null; message?: string | null } | null | undefined

/** Mensaje en español para un error de Supabase Auth. */
export function authErrorMessage(error: AuthLikeError): string {
  if (!error) return AUTH_GENERIC_ERROR
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code]
  if (error.status === 429) return BY_CODE.over_request_rate_limit
  // Sesión ausente al cambiar la contraseña (no trae `code` en todas las versiones del SDK).
  if (/session missing/i.test(error.message ?? '')) return BY_CODE.session_not_found
  return AUTH_GENERIC_ERROR
}

// Motivos que viajan por `?error=` desde /auth/callback (clave corta, nunca texto libre).
const BY_REASON: Record<string, string> = {
  link: 'El enlace no es válido o ya expiró. Pide uno nuevo.',
  expired: 'Tu enlace de recuperación expiró. Pide uno nuevo.',
}
export function authReasonMessage(reason: string | null | undefined): string | null {
  return reason ? BY_REASON[reason] ?? null : null
}
