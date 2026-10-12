import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Next.js 16: proxy.ts (runtime Node). Refresca la sesión Supabase y protege rutas privadas.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Excluye estáticos, imágenes y /api (el proxy de fotos y el conserje no necesitan sesión).
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
