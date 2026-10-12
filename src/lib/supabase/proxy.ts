import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Rutas que requieren sesión. El resto de la app (feed, places, concierge) es pública.
const PROTECTED = ['/profile', '/saved', '/panel', '/admin', '/onboarding']
const AUTH_ROUTES = ['/login', '/signup']

// Coincide con la ruta exacta o un subpath ('/panel' y '/panel/x', pero no '/panelistas').
const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

export async function updateSession(request: NextRequest) {
  let res = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          res = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && PROTECTED.some((p) => matches(path, p))) {
    // Conserva la query original en `next` (pathname + search) y no la arrastra a /login.
    const url = new URL('/login', request.url)
    url.searchParams.set('next', path + request.nextUrl.search)
    return NextResponse.redirect(url)
  }
  if (user && AUTH_ROUTES.some((p) => matches(path, p))) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return res
}
