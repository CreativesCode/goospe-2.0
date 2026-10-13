'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'
import { authErrorMessage } from '@/lib/auth-errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { TERMS_REQUIRED, TERMS_VERSION, termsAccepted } from '@/features/profile/terms'

const emailSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  z.string().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Escribe un email válido')
)
const passwordSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v : ''),
  z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72, 'La contraseña es demasiado larga')
)
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema })
// Al ENTRAR no se exige el mínimo actual: una cuenta antigua puede tener otra política.
const loginSchema = z.object({
  email: emailSchema,
  password: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().min(1).max(200)),
})
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Revisa los datos e intenta de nuevo.'

// Origen público del sitio para los enlaces de los emails. Variable de entorno si existe;
// si no, el host de la petición (el deploy está detrás de Vercel, que fija estas cabeceras).
async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
  if (env) return env
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

// Los enlaces de confirmación / recuperación aterrizan en /auth/callback, que canjea el
// código por una sesión y redirige a `next`.
const callbackUrl = async (next: string) => `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  // Sin pista de qué campo falla: no se distingue "no existe" de "contraseña mala".
  if (!parsed.success) return { error: 'Email o contraseña incorrectos.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authErrorMessage(error) }
  revalidatePath('/', 'layout')
  redirect(safeNext(formData.get('next'))) // sólo rutas internas (evita open redirect)
}

export async function signup(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  // Aceptación explícita de los términos: sin la casilla marcada no se crea la cuenta.
  if (!termsAccepted(formData.get('terms'))) return { error: TERMS_REQUIRED }
  const rawName = formData.get('display_name')
  const displayName = (typeof rawName === 'string' ? rawName.trim().slice(0, 80) : '') || null

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { full_name: displayName }, // lo lee handle_new_user → profiles.display_name
      emailRedirectTo: await callbackUrl('/onboarding'),
    },
  })
  if (error) return { error: authErrorMessage(error) }
  // Deja constancia de la aceptación (momento y versión). Solo si la cuenta es NUEVA: para un
  // email ya registrado Supabase devuelve un usuario ficticio sin identidades. Las columnas no
  // son escribibles por el usuario (0042), por eso va con service role. Sin la migración
  // aplicada el update falla y el registro sigue adelante.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    const { error: termsErr } = await createAdminClient().from('profiles')
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).eq('id', data.user.id)
    if (termsErr) console.error('[signup] términos:', termsErr.message)
  }
  revalidatePath('/', 'layout')
  // Si la confirmación de email está desactivada, ya hay sesión → al onboarding; si no, a check-email.
  if (data.session) redirect('/onboarding')
  redirect('/check-email')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/feed')
}

export async function resetPassword(formData: FormData) {
  const email = emailSchema.safeParse(formData.get('email'))
  if (!email.success) return { error: firstIssue(email.error) }
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: await callbackUrl('/update-password'),
  })
  if (error) return { error: authErrorMessage(error) }
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const password = passwordSchema.safeParse(formData.get('password'))
  if (!password.success) return { error: firstIssue(password.error) }
  const supabase = await createClient()
  // Sin sesión (enlace vencido o abierto en otro navegador) no hay a quién cambiarle la clave.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=expired')
  const { error } = await supabase.auth.updateUser({ password: password.data })
  if (error) return { error: authErrorMessage(error) }
  revalidatePath('/', 'layout')
  redirect('/feed')
}
