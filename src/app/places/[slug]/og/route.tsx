import { getPlace, placeCategories, placeCity } from '@/features/places/place-data'
import { isSlug } from '@/features/places/seo-routes'
import { ogCard } from '@/shared/lib/og-card'

// Imagen para compartir GENERADA de una ficha (og:image) cuando el lugar no tiene portada ni
// foto propia: sus únicas fotos son de Google y el proxy puede devolver error a un rastreador.
// Solo lugares publicados; el resto recibe la tarjeta genérica con 404.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const place = isSlug(slug) ? await getPlace(slug) : null
  if (!place || place.is_published !== true) {
    return ogCard({ eyebrow: 'Lugares', title: '¿Dónde voy hoy?', subtitle: 'Lugares y eventos cerca de ti', status: 404 })
  }
  const city = (place.address as { city?: string } | null)?.city?.trim() || placeCity(place)?.name || null
  return ogCard({
    eyebrow: placeCategories(place)[0]?.name ?? 'Lugar',
    title: place.name,
    subtitle: place.vibe_line,
    footer: city,
  })
}
