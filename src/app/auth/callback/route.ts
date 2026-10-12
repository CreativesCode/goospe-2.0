import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

// Destino de los enlaces de los emails de Supabase Auth (confirmar registro, recuperar
// contraseña, magic link). Sin esta ruta el enlace volvía a la app SIN sesión: el usuario
// confirmaba su email o abría "recuperar contraseña" y seguía deslogueado.
//
// Acepta los dos formatos que emite Supabase:
//   · ?code=…                     flujo PKCE          → exchangeCodeForSession
//   · ?token_hash=…&type=…        plantilla de email  → verifyOtp
// y redirige a `next` (solo rutas internas, vía safeNext).
const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']
const isOtpType = (v: string | null): v is EmailOtpType => !!v && (OTP_TYPES as readonly string[]).includes(v)

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const code = sp.get('code')
  const tokenHash = sp.get('token_hash')
  const type = sp.get('type')
  // Una recuperación sin `next` explícito va a definir la contraseña nueva.
  const next = safeNext(sp.get('next'), type === 'recovery' ? '/update-password' : '/feed')

  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))
  // Motivo corto y fijo: nunca se refleja en la URL el texto del proveedor.
  const failed = () => to(next === '/update-password' ? '/forgot-password?error=expired' : '/login?error=link')

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession:', error.code ?? error.message)
      return failed()
    }
    return to(next)
  }

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error('[auth/callback] verifyOtp:', error.code ?? error.message)
      return failed()
    }
    return to(next)
  }

  return failed()
}
