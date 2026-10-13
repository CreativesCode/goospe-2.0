import { fmtInZone } from '@/lib/tz'
import { getPublicEvent } from '@/features/events/queries'
import { ogCard } from '@/shared/lib/og-card'

// Imagen para compartir GENERADA de un evento (og:image) cuando el dueño no subió una imagen.
// Solo eventos visibles para el público (ver getPublicEvent); el resto, tarjeta genérica + 404.

// La tarjeta lleva la fecha y el estado ("Evento cancelado"): si el dueño mueve o cancela el
// evento no puede quedarse un día en la CDN como la de una ficha. 5 min en el navegador, 10 en
// la CDN (lo mismo que la ISR de la página del evento).
const EVENT_OG_CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getPublicEvent(id).catch(() => null)
  if (!ev) {
    return ogCard({ eyebrow: 'Eventos', title: '¿Dónde voy hoy?', subtitle: 'Lugares y eventos cerca de ti', status: 404 })
  }
  const tz = ev.places.cities?.timezone ?? null
  const when = fmtInZone(ev.starts_at, tz, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const city = ev.places.cities?.name ?? ev.places.address?.city ?? null
  return ogCard({
    eyebrow: ev.status === 'cancelled' ? 'Evento cancelado' : 'Evento',
    title: ev.name,
    subtitle: `${when.charAt(0).toUpperCase()}${when.slice(1)} h`,
    footer: [ev.places.name, city].filter(Boolean).join(' · '),
    cacheControl: EVENT_OG_CACHE,
  })
}
