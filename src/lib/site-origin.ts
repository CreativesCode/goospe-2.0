import 'server-only'
import { headers } from 'next/headers'

// Origen público del sitio para los enlaces que Supabase Auth manda por email (misma regla
// que src/actions/auth.ts): variable de entorno si existe; si no, el host de la petición
// (el deploy está detrás de Vercel, que fija estas cabeceras).
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
  if (env) return env
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Enlace de email → /auth/callback, que canjea el código por sesión y redirige a `next`. */
export const authCallbackUrl = async (next: string) =>
  `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`
