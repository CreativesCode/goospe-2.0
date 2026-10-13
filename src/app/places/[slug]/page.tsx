import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlace, placeCity, placePhotos } from '@/features/places/place-data'
import { PlaceView } from '@/features/places/PlaceView'
import { metaDescription, placePath, placeShareImage } from '@/features/places/seo-routes'

// Ficha pública de un lugar. Un lugar NO publicado (pausado por su dueño u oculto por el
// equipo) responde 404 real: antes se podía abrir por URL directa. Su dueño y los admins lo
// ven en /places/[slug]/preview (ruta con sesión, fuera de la caché pública).

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPlace(slug)
  // notFound() también aquí: los metadatos se resuelven antes de enviar la respuesta, así el
  // estado HTTP es 404 y no un 200 con la página de error.
  if (!data || data.is_published !== true) notFound()
  // Ciudad real del propio lugar (dinámica), no una fija; si no hay, copy sin ciudad.
  const city = (data.address as { city?: string } | null)?.city?.trim() || placeCity(data)?.name || null
  const title = city ? `${data.name} — ${city} | Goospe` : `${data.name} | Goospe`
  const description = metaDescription(data.vibe_line || data.description) ||
    (city ? `Descubre ${data.name} en ${city} con Goospe.` : `Descubre ${data.name} con Goospe.`)
  // Imagen de compartir: portada del dueño → foto aprobada propia → tarjeta generada. Nunca
  // el proxy de fotos de Google (con la facturación apagada devuelve error al rastreador).
  const image = placeShareImage(data.slug, data.cover_url, placePhotos(data))
  return {
    title,
    description,
    alternates: { canonical: placePath(slug) },
    openGraph: {
      title,
      description,
      url: placePath(slug),
      siteName: 'Goospe',
      type: 'website',
      images: [{ url: image, alt: data.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

// ISR: la ficha es casi estática (contenido IA + datos del lugar). Se regenera cada hora;
// las partes con sesión (guardar, RSVP, reseñas, subir foto) son client components que
// cargan su propio estado. Un lugar recién publicado se genera on-demand (dynamicParams).
export const revalidate = 3600

// Pre-renderiza los slugs publicados en build para TTFB instantáneo + buen SEO.
export async function generateStaticParams() {
  try {
    const sb = createAdminClient()
    // Solo una parte se genera en el build (cada ficha hace varias consultas y el build se
    // alargaba a 6 min con timeouts); el resto se genera on-demand y queda en caché (ISR).
    const { data } = await sb.from('places').select('slug').eq('is_published', true).order('slug').limit(200)
    return (data ?? []).map((p) => ({ slug: p.slug as string }))
  } catch {
    // Si la BD no está disponible en build, no fallar: las fichas se generan on-demand.
    return []
  }
}

export default async function PlaceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const place = await getPlace(slug) // dedupe con generateMetadata (React cache)
  if (!place || place.is_published !== true) notFound()
  return <PlaceView place={place} />
}
