'use client'

import Link from 'next/link'
import { Calendar, Sparkles, Check, Star, Compass, MapPin } from 'lucide-react'
import { track } from '@/lib/track'
import { useImgFallback } from '@/shared/components/photo-img'
import { fmtInZone } from '@/lib/tz'
import { EventAttendanceLive } from './EventAttendanceLive'
import { useRsvp } from './use-rsvp'

export type FeedEvent = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  starts_at: string
  place_id: string
  place_slug: string
  place_name: string
  lat: number
  lng: number
  distance_m: number
  photo_url: string | null
  boosted: boolean
  /** Zona horaria de la ciudad del lugar (migración 0035). Sin ella: la del dispositivo. */
  timezone?: string | null
}

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
// La hora del evento se muestra SIEMPRE en la zona de la ciudad donde ocurre.
const fmtWhen = (s: string, tz: string | null | undefined) =>
  fmtInZone(s, tz, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export function EventFeedCard({ ev }: { ev: FeedEvent }) {
  const { status, busy, ready, choose } = useRsvp(ev.id)
  const img = useImgFallback()
  const eventHref = `/events/${ev.id}`

  // "Apertura" del evento: desde su card se abre la página del evento (o la ficha del lugar).
  // Va solo con event_id (sin place_id) para no contarse dos veces en las vistas de la ficha,
  // que registra DetailTracker.
  // Lo lee event_boost_stats (0039) para medir el rendimiento de un evento destacado.
  const onOpen = () => track('view_detail', { eventId: ev.id })

  return (
    <section data-track-id={ev.id} data-kind="event" className="relative h-[100dvh] w-full snap-start snap-always">
      {ev.photo_url && !img.failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img.ref}
          src={ev.photo_url}
          alt={ev.name}
          loading="lazy"
          decoding="async"
          onError={img.onError}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-goospe-gradient text-white/90">
          <Calendar size={96} strokeWidth={1.1} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />

      {/* etiquetas. top incluye var(--sat) para quedar bajo el header flotante del feed. */}
      <div className="absolute left-4 top-[calc(8rem+var(--sat))] z-10 flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur"><Calendar size={13} strokeWidth={2} /> Evento</span>
        {ev.boosted && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-goospe-gradient px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/40"><Sparkles size={13} strokeWidth={2} /> Destacado</span>
        )}
      </div>

      {/* acciones laterales (z por encima del bloque de info, que va después en el DOM) */}
      <div className="text-shadow-photo absolute bottom-40 right-4 z-[11] flex flex-col gap-5 text-white">
        <button
          type="button"
          onClick={() => choose('interested')}
          disabled={busy || !ready}
          aria-pressed={status === 'interested'}
          aria-busy={busy}
          className="flex flex-col items-center gap-1 disabled:opacity-60"
        >
          <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${status === 'interested' ? 'bg-goospe-green' : 'bg-white/20'}`}>
            <Star size={22} strokeWidth={1.75} fill={status === 'interested' ? 'currentColor' : 'none'} />
          </span>
          <span className="text-xs">Me interesa</span>
        </button>
        <button
          type="button"
          onClick={() => choose('going')}
          disabled={busy || !ready}
          aria-pressed={status === 'going'}
          aria-busy={busy}
          className="flex flex-col items-center gap-1 disabled:opacity-60"
        >
          <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${status === 'going' ? 'bg-goospe-green' : 'bg-white/20'}`}>
            <Check size={22} strokeWidth={2} />
          </span>
          <span className="text-xs">Asistiré</span>
        </button>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`}
          target="_blank" rel="noreferrer"
          onClick={() => track('directions', { placeId: ev.place_id, eventId: ev.id })}
          className="flex flex-col items-center gap-1"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Compass size={22} strokeWidth={1.75} /></span>
          <span className="text-xs">Cómo llego</span>
        </a>
        <Link href={`/places/${ev.place_slug}`} onClick={onOpen} className="flex flex-col items-center gap-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur"><MapPin size={22} strokeWidth={1.75} /></span>
          <span className="text-xs">El lugar</span>
        </Link>
      </div>

      {/* info — pr-20 deja espacio a las acciones laterales; pb-28 a la barra Decídeme */}
      <div className="text-shadow-photo absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-28 pr-20 text-white">
        <p className="text-sm font-medium text-goospe-green-light drop-shadow first-letter:uppercase">{fmtWhen(ev.starts_at, ev.timezone)}</p>
        <h2 className="text-3xl font-medium leading-tight drop-shadow">
          <Link href={eventHref} onClick={onOpen}>{ev.name}</Link>
        </h2>
        <Link href={`/places/${ev.place_slug}`} onClick={onOpen} className="block text-white/80">
          en {ev.place_name} · {fmtDist(ev.distance_m)}
        </Link>
        <EventAttendanceLive eventId={ev.id} className="text-white/90" />
        {ev.description && <p className="line-clamp-2 max-w-md text-sm text-white/80">{ev.description}</p>}
        <Link href={eventHref} onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-4">
          Ver evento
        </Link>
      </div>
    </section>
  )
}
