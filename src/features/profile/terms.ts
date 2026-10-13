// Versión vigente de los Términos y la Política de privacidad (fecha de su última
// actualización, la misma que muestran /terms y /privacy). Se guarda junto al momento de la
// aceptación en profiles.terms_version al registrarse. Al cambiar los textos legales, subir
// esta fecha: quedará registrado qué versión aceptó cada cuenta.
export const TERMS_VERSION = '2026-06-18'

export const TERMS_REQUIRED = 'Para crear tu cuenta debes aceptar los Términos y la Política de privacidad.'

/** El checkbox del registro llega como "on" (valor por defecto de un checkbox marcado). */
export const termsAccepted = (v: unknown): boolean => v === 'on' || v === 'true' || v === '1'
