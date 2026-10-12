import { NextRequest } from 'next/server'

// Proxy server-side de Google Place Photos. Sirve la foto en vivo con la API key oculta
// (cumple ToS: mostrar, no guardar) y es RESILIENTE a los timeouts intermitentes de Google
// (ConnectTimeoutError): reintenta con backoff. Si la foto no se puede servir responde 404
// (NO redirige a un SVG): así el <img> dispara onError y la UI pinta su placeholder diseñado
// (gradiente + icono de categoría) en vez de un isotipo gigante recortado.
const ATTEMPTS = 3
const PER_TRY_TIMEOUT_MS = 8000

// Formato real de Google Places (New): places/<placeId>/photos/<photoRef>. Regex estricta para
// que el endpoint no sirva de proxy abierto hacia otras rutas de la API (sin '?', '#', '..', espacios).
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{1,256}\/photos\/[A-Za-z0-9_-]{1,2048}$/
const DEFAULT_W = 800
const MIN_W = 64
const MAX_W = 1600

// Cortacircuitos en memoria del proceso: un 403 de Google (facturación desactivada / key sin
// permiso) afecta a TODAS las fotos. Durante 10 min se responde 404 sin llamar, para no
// martillar a Google con miles de peticiones que van a fallar. Es por instancia (serverless):
// cada instancia nueva hace una sola llamada de prueba.
const BREAKER_MS = 10 * 60 * 1000
let breakerUntil = 0

// Ancho entero acotado; cualquier valor inválido cae al ancho por defecto.
function parseWidth(raw: string | null): number {
  if (raw == null || !/^\d{1,5}$/.test(raw)) return DEFAULT_W
  return Math.min(MAX_W, Math.max(MIN_W, Number(raw)))
}

// Caché corta: cuando la foto vuelva a estar disponible se recupera sola en minutos.
const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
  })

async function fetchPhoto(url: string): Promise<Response | null> {
  let last: unknown
  for (let i = 0; i < ATTEMPTS; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PER_TRY_TIMEOUT_MS)
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) return res
      // 4xx que no sea 429 = error permanente: no reintentar.
      if (res.status !== 429 && res.status < 500) {
        if (res.status === 403) breakerUntil = Date.now() + BREAKER_MS
        // 404 = referencia vencida (esperable). Cualquier otro 4xx es un problema de cuenta
        // o de configuración y NO debe pasar en silencio.
        if (res.status !== 404) {
          console.error(
            `[place-photo] Google respondió ${res.status}` +
              (res.status === 403 ? ' (¿facturación o API key?). Cortacircuitos 10 min.' : '')
          )
        }
        return null
      }
      last = new Error(`upstream ${res.status}`)
    } catch (e) {
      clearTimeout(timer)
      last = e // timeout / connect error → reintentar
    }
    if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 350 * (i + 1)))
  }
  console.warn('[place-photo] agotados reintentos:', (last as Error)?.message)
  return null
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  const w = parseWidth(req.nextUrl.searchParams.get('w'))
  const key = process.env.GOOGLE_MAPS_API_KEY

  if (!name || !PHOTO_NAME_RE.test(name) || !key) return notFound()
  if (Date.now() < breakerUntil) return notFound() // cortacircuitos abierto: ni se intenta

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&key=${encodeURIComponent(key)}`
  const res = await fetchPhoto(url)
  if (!res) return notFound()

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      // Caché en dos niveles para no re-pegarle (ni re-pagarle) a Google en cada miss:
      // - max-age (navegador, privado) 7 días
      // - s-maxage (CDN compartido, p. ej. Vercel Edge) 30 días → la primera carga de
      //   cada foto la sirve Google una sola vez; el resto de usuarios la toman del CDN
      // - stale-while-revalidate: sirve la copia vieja mientras revalida en background
      'Cache-Control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400, immutable',
    },
  })
}
