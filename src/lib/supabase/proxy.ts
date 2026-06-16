import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Rutas que requieren sesión. El resto de la app (feed, places, concierge) es pública.
const PROTECTED = ['/profile', '/saved', '/panel', '/admin']
const AUTH_ROUTES = ['/login', '/signup']

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

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  if (user && AUTH_ROUTES.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return res
}
