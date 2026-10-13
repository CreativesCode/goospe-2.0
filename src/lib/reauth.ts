import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Re-autenticación con contraseña para acciones sensibles (cambiar email o contraseña,
 * eliminar la cuenta). Devuelve el id del usuario al que pertenece esa combinación de email
 * y contraseña, o null si no es válida.
 *
 * Usa un cliente APARTE, sin cookies ni almacenamiento: comprobar la contraseña no toca la
 * sesión del navegador, y la sesión temporal que crea se cierra antes de devolver.
 * Quien llama DEBE comparar el id devuelto con el de su sesión (decideDeletion lo hace).
 */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon || !email || !password) return null
  try {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error || !data.user) return null
    const id = data.user.id
    // Solo esta sesión temporal; las demás del usuario siguen abiertas.
    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
    return id
  } catch (e) {
    console.error('[reauth]', (e as Error).message)
    return null
  }
}
