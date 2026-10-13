import { absoluteUrl } from '@/lib/email/config'
import { buildIcs, icsFilename } from '@/lib/ics'
import { eventLocationText, getPublicEvent } from '@/features/events/queries'
import { eventPath } from '@/features/places/seo-routes'

// "Agregar al calendario": descarga el .ics de un evento público. Un evento cancelado se
// entrega como cancelación (quien ya lo tenía importado lo ve tachado).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getPublicEvent(id).catch(() => null)
  const body = ev && buildIcs({
    uid: `${ev.id}@goospe`,
    title: ev.name,
    description: ev.description,
    location: eventLocationText(ev.places),
    start: ev.starts_at,
    end: ev.ends_at,
    url: absoluteUrl(eventPath(ev.id)),
    cancelled: ev.status === 'cancelled',
  })
  if (!ev || !body) return new Response('Evento no encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${icsFilename(ev.name)}"`,
      // El dueño puede mover o cancelar el evento: caché corta.
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex',
    },
  })
}
