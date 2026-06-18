'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Sparkles, Check, Ticket, Compass, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toggleRsvp } from '@/actions/events'
import { track } from '@/lib/track'

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
}

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
const fmtWhen = (s: string) =>
  new Date(s).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export function EventFeedCard({ ev }: { ev: FeedEvent }) {
  const [going, setGoing] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      setAuthed(!!user)
      if (!user) return
      const { data } = await sb.from('event_rsvps').select('event_id').eq('user_id', user.id).eq('event_id', ev.id).maybeSingle()
      setGoing(!!data)
    })
  }, [ev.id])

  async function onRsvp() {
    if (authed === false) { window.location.href = '/login?next=/feed'; return }
    setBusy(true)
    const fd = new FormData(); fd.set('event_id', ev.id); fd.set('status', 'going')
    const res = await toggleRsvp(fd)
    setBusy(false)
    if (res?.error) { alert(res.error); return }
    if (res.going) track('rsvp', { eventId: ev.id })
    setGoing(!!res.going)
  }

  return (
    <section data-track-id={ev.id} data-kind="event" className="relative h-[100dvh] w-full snap-start snap-always">
      {ev.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ev.photo_url} alt={ev.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-goospe-gradient">
          <img src="/brand/isotipo-white.svg" alt="" className="h-20 w-20 opacity-90" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />

      {/* etiquetas */}
      <div className="absolute left-4 top-32 z-10 flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur"><Calendar size={13} strokeWidth={2} /> Evento</span>
        {ev.boosted && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-goospe-gradient px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/40"><Sparkles size={13} strokeWidth={2} /> Destacado</span>
        )}
      </div>

      {/* acciones laterales */}
      <div className="text-shadow-photo absolute bottom-40 right-4 z-10 flex flex-col gap-5 text-white">
        <button onClick={onRsvp} disabled={busy} className="flex flex-col items-center gap-1">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${going ? 'bg-goospe-green' : 'bg-white/20'}`}>
            {going ? <Check size={22} strokeWidth={2} /> : <Ticket size={22} strokeWidth={1.75} />}
          </span>
          <span className="text-xs">{going ? 'Asistiré' : 'Me interesa'}</span>
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
        <Link href={`/places/${ev.place_slug}`} className="flex flex-col items-center gap-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur"><MapPin size={22} strokeWidth={1.75} /></span>
          <span className="text-xs">El lugar</span>
        </Link>
      </div>

      {/* info — pr-20 deja espacio a las acciones laterales; pb-28 a la barra Decídeme */}
      <div className="text-shadow-photo absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-28 pr-20 text-white">
        <p className="text-sm font-medium capitalize text-goospe-green-light drop-shadow">{fmtWhen(ev.starts_at)}</p>
        <h2 className="text-3xl font-medium leading-tight drop-shadow">{ev.name}</h2>
        <Link href={`/places/${ev.place_slug}`} className="block text-white/80">
          en {ev.place_name} · {fmtDist(ev.distance_m)}
        </Link>
        {ev.description && <p className="line-clamp-2 max-w-md text-sm text-white/80">{ev.description}</p>}
      </div>
    </section>
  )
}
