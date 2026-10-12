import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, clientKey } from '@/lib/rate-limit'
import { setSubscription } from '@/lib/email/preferences'
import { readUnsubscribeToken } from '@/lib/email/tokens'

// Baja de un clic (RFC 8058). Es la URL de la cabecera List-Unsubscribe: el proveedor de correo
// (Gmail, Yahoo…) hace un POST aquí cuando la persona pulsa "Cancelar suscripción", sin abrir
// la web y sin sesión. La autorización es el token firmado de la query.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_HOUR_IP = 120

export async function POST(request: NextRequest) {
  if (!(await rateLimit(`unsubscribe:${clientKey(request)}`, 3600, MAX_PER_HOUR_IP))) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  const target = readUnsubscribeToken(request.nextUrl.searchParams.get('token'))
  if (!target) return NextResponse.json({ ok: false }, { status: 400 })
  const ok = await setSubscription(target.userId, target.category, false, 'one_click')
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
}

// Un GET (alguien abrió la URL de la cabecera en el navegador) NO da de baja: los antivirus y
// las vistas previas siguen enlaces solos. Se manda a la página, donde se confirma con un botón.
export function GET(request: NextRequest) {
  const url = new URL('/unsubscribe', request.nextUrl.origin)
  const token = request.nextUrl.searchParams.get('token')
  if (token) url.searchParams.set('token', token)
  return NextResponse.redirect(url)
}
