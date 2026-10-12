import 'server-only'
import { createHmac } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type RpcFn = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

// Límite de frecuencia por ventana fija, respaldado por el RPC `rate_limit_hit`
// (SECURITY DEFINER, sólo service_role). Devuelve true si la petición está PERMITIDA.
// Por defecto falla ABIERTO: si el RPC no responde (p. ej. migración aún no aplicada) se
// permite y se loguea. Lo que gasta dinero (conserje) debe pasar `{ failOpen: false }`.
export async function rateLimit(
  key: string,
  windowSeconds: number,
  max: number,
  { failOpen = true }: { failOpen?: boolean } = {}
): Promise<boolean> {
  try {
    const admin = createAdminClient()
    // rpc no está en los tipos generados → cast al estilo del resto del repo.
    const rpc = admin.rpc.bind(admin) as unknown as RpcFn
    const { data, error } = await rpc('rate_limit_hit', {
      p_key: key, p_window_seconds: windowSeconds, p_max: max,
    })
    if (error) {
      console.error(`[rate-limit] rpc falló, se ${failOpen ? 'permite' : 'rechaza'}:`, error.message)
      return failOpen
    }
    return data !== false
  } catch (e) {
    console.error(`[rate-limit] error inesperado, se ${failOpen ? 'permite' : 'rechaza'}:`, (e as Error).message)
    return failOpen
  }
}

// Clave estable del cliente derivada de su IP. Nunca se guarda la IP en claro: HMAC-SHA256
// con un secreto del servidor (un sha256 simple de una IPv4 es reversible por fuerza bruta).
// La IP es fiable porque el deploy está en Vercel, que sobrescribe estas cabeceras; detrás
// de otro proxy x-forwarded-for sería falsificable.
export function clientKey(request: Request): string {
  const h = request.headers
  const ip =
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  // Secreto dedicado si existe; si no, el service role (siempre presente en el servidor).
  // Sin ninguno no se usa una constante pública: todos comparten la clave 'unknown'.
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return 'unknown'
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32)
}
