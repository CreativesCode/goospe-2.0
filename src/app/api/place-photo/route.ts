import { NextRequest } from 'next/server'

// Proxy server-side de Google Place Photos. Mantiene la API key oculta (nunca llega al cliente)
// y NO almacena la imagen: la sirve en vivo desde Google (cumple ToS: mostrar, no guardar).
// El navegador la cachea por el Cache-Control. `name` = recurso "places/{id}/photos/{id}".
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  const w = req.nextUrl.searchParams.get('w') ?? '800'
  if (!name || !name.startsWith('places/')) {
    return new Response('bad name', { status: 400 })
  }
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return new Response('no key', { status: 500 })

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${encodeURIComponent(w)}&key=${key}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: res.status })

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
