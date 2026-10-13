import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isMalformedSeoPath } from '@/features/places/seo-routes'

// Next.js 16: proxy.ts (runtime Node). Refresca la sesión Supabase y protege rutas privadas.
export async function proxy(request: NextRequest) {
  // Listados y eventos con una forma imposible ("/c/x/1", "/events/abc"): 404 directo. Se
  // reescribe a una ruta que no existe para servir el 404 de la app sin renderizar la página
  // dinámica (que guardaría una entrada en la caché ISR por cada URL basura).
  if (isMalformedSeoPath(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL('/_malformed-path', request.url), { status: 404 })
  }
  return await updateSession(request)
}

export const config = {
  // Excluye estáticos, imágenes y /api (el proxy de fotos y el conserje no necesitan sesión).
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
