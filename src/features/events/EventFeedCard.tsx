'use client'

import Link from 'next/link'
import { Calendar, Sparkles, Check, Star, Compass, MapPin } from 'lucide-react'
import { track } from '@/lib/track'
import { PhotoImg } from '@/shared/components/photo-img'
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
  const eventHref = `/events/${ev.id}`

  // "Apertura" del evento: desde su card se abre la página del evento (o la ficha del lugar).
  // Va solo con event_id (sin place_id) para no contarse dos veces en las vistas de la ficha,
  // que registra DetailTracker.
  // Lo lee event_boost_stats (0039) para medir el rendimiento de un evento destacado.
  const onOpen = () => track('view_detail', { eventId: ev.id })

  const action = 'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-[6px] transition'

  return (
    <article data-track-id={ev.id} data-kind="event" className="relative h-full w-full snap-start snap-always overflow-hidden">
      <PhotoImg
        src={ev.photo_url}
        alt={ev.name}
        tone="deep"
        className="absolute inset-0 h-full w-full object-cover pb-[200px] [&:is(img)]:pb-0"
        fallback={<Calendar size={92} strokeWidth={1.1} />}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,9,0.92),rgba(10,10,9,0.1)_52%,rgba(10,10,9,0.5))]" />

      {/* acciones laterales (z por encima del bloque de info, que va después en el DOM) */}
      <div className="absolute bottom-7 right-3.5 z-[11] flex flex-col gap-3.5 text-center text-[11px] text-white">
        <button
          type="button"
          onClick={() => choose('interested')}
          disabled={busy || !ready}
          aria-pressed={status === 'interested'}
          aria-busy={busy}
          className="disabled:opacity-60"
        >
          <span className={`${action} ${status === 'interested' ? 'bg-goospe-green text-on-brand' : 'bg-white/[0.18]'}`}>
            <Star size={21} strokeWidth={1.75} fill={status === 'interested' ? 'currentColor' : 'none'} />
          </span>
          <span className="mt-1 block">Me interesa</span>
        </button>
        <button
          type="button"
          onClick={() => choose('going')}
          disabled={busy || !ready}
          aria-pressed={status === 'going'}
          aria-busy={busy}
          className="disabled:opacity-60"
        >
          <span className={`${action} ${status === 'going' ? 'bg-goospe-green text-on-brand' : 'bg-white/[0.18]'}`}>
            <Check size={21} strokeWidth={2} />
          </span>
          <span className="mt-1 block">Asistiré</span>
        </button>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`}
          target="_blank" rel="noreferrer"
          onClick={() => track('directions', { placeId: ev.place_id, eventId: ev.id })}
        >
          <span className={`${action} bg-white/[0.18]`}><Compass size={21} strokeWidth={1.75} /></span>
          <span className="mt-1 block">Cómo llego</span>
        </a>
        <Link href={`/places/${ev.place_slug}`} onClick={onOpen}>
          <span className={`${action} bg-white/[0.18]`}><MapPin size={21} strokeWidth={1.75} /></span>
          <span className="mt-1 block">El lugar</span>
        </Link>
      </div>

      {/* info */}
      <div className="text-shadow-photo absolute bottom-7 left-[18px] right-[84px] z-10 text-white">
        <div className="mb-2.5 flex flex-wrap gap-1.5 [text-shadow:none]">
          <span className="inline-flex items-center gap-[5px] rounded-full bg-white/[0.16] px-2.5 py-1 text-[11px] leading-none"><Calendar size={12} strokeWidth={2} /> Evento</span>
          {ev.boosted && (
            <span className="inline-flex items-center gap-[5px] rounded-full bg-goospe-gradient px-2.5 py-1 text-[11px] font-medium leading-none text-on-brand"><Sparkles size={12} strokeWidth={2} /> Destacado</span>
          )}
        </div>
        <p className="text-[13px] text-white/[0.82] first-letter:uppercase">{fmtWhen(ev.starts_at, ev.timezone)} h</p>
        <h2 className="mt-1 text-[30px] font-medium leading-[1.1]">
          <Link href={eventHref} onClick={onOpen}>{ev.name}</Link>
        </h2>
        <Link href={`/places/${ev.place_slug}`} onClick={onOpen} className="mt-1 block text-[17px] font-medium text-goospe-green-light">
          en {ev.place_name} · {fmtDist(ev.distance_m)}
        </Link>
        <EventAttendanceLive eventId={ev.id} className="mt-2 text-white/90" />
        {ev.description && <p className="mt-2 line-clamp-2 text-sm leading-[1.45] text-white/[0.82]">{ev.description}</p>}
        <Link href={eventHref} onClick={onOpen} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-4">
          Ver evento
        </Link>
      </div>
    </article>
  )
}
