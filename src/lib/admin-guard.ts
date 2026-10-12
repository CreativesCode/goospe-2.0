import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/ownership'

// Usuario de la sesión si es admin; null en cualquier otro caso. Para route handlers
// (que responden 401/403 en vez de redirigir).
export async function getAdminUser(): Promise<{ user: User | null; admin: boolean }> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { user: null, admin: false }
  return { user, admin: await isAdmin(user.id) }
}

// Guard de PÁGINA para /admin/*: debe ser la primera instrucción de cada page.tsx.
// El layout NO basta: Next renderiza layout y página en paralelo, así que la página
// alcanzaría a consultar con service-role antes de que el redirect del layout surta efecto.
export async function requireAdmin(next = '/admin'): Promise<User> {
  const { user, admin } = await getAdminUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!admin) redirect('/feed')
  return user
}
