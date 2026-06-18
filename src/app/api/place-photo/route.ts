import { NextRequest } from 'next/server'

// Proxy server-side de Google Place Photos. Sirve la foto en vivo con la API key oculta
// (cumple ToS: mostrar, no guardar) y es RESILIENTE a los timeouts intermitentes de Google
// (ConnectTimeoutError): reintenta con backoff y, si aun así falla, degrada al isotipo de marca
// en vez de mostrar una imagen rota.
const ATTEMPTS = 3
const PER_TRY_TIMEOUT_MS = 8000

async function fetchPhoto(url: string): Promise<Response | null> {
  let last: unknown
  for (let i = 0; i < ATTEMPTS; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PER_TRY_TIMEOUT_MS)
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) return res
      // 4xx que no sea 429 = error permanente (ref inválida): no reintentar
      if (res.status !== 429 && res.status < 500) return null
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
  const w = req.nextUrl.searchParams.get('w') ?? '800'
  const key = process.env.GOOGLE_MAPS_API_KEY
  // El fallback (foto rota / ref inválida) NO se cachea: un lugar puede ganar foto válida
  // después, y no queremos que el CDN sirva el isotipo de forma permanente.
  const fallback = () =>
    new Response(null, {
      status: 302,
      headers: {
        Location: new URL('/brand/isotipo-color.svg', req.nextUrl.origin).toString(),
        'Cache-Control': 'no-store',
      },
    })

  if (!name || !name.startsWith('places/') || !key) return fallback()

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${encodeURIComponent(w)}&key=${key}`
  const res = await fetchPhoto(url)
  if (!res) return fallback()

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
