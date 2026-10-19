import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CalendarPlus, CalendarX, Clock, Compass, History, MapPin } from 'lucide-react'
import { absoluteUrl } from '@/lib/email/config'
import { eventEndMs, googleCalendarUrl, type CalendarEvent } from '@/lib/ics'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmtInZone } from '@/lib/tz'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { Breadcrumbs } from '@/shared/components/breadcrumbs'
import { JsonLd } from '@/shared/components/json-ld'
import { PhotoImg } from '@/shared/components/photo-img'
import { appContainer, eyebrow } from '@/shared/lib/ui'
import { EventAttendanceLive } from '@/features/events/EventAttendanceLive'
import { EventShare } from '@/features/events/EventShare'
import { RsvpButton } from '@/features/events/RsvpButton'
import { eventPhase } from '@/features/events/event-time'
import { eventAddressText, eventLocationText, getPublicEvent } from '@/features/events/queries'
import { eventIcsPath, eventOgPath, eventPath, metaDescription, placePath } from '@/features/places/seo-routes'

// Página propia y compartible de un evento. ISR corta (10 min): el estado "ya pasó" depende
// de la hora. Se genera bajo demanda (`generateStaticParams` vacío solo activa la caché por
// ruta). Un evento cancelado o pasado se muestra como tal; solo es 404 si no existe, no está
// aprobado o su lugar no está publicado.
export const revalidate = 600
export const generateStaticParams = async () => []

type Props = { params: Promise<{ id: string }> }

const fmtDay = (iso: string, tz: string | null) =>
  fmtInZone(iso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtHour = (iso: string, tz: string | null) => fmtInZone(iso, tz, { hour: '2-digit', minute: '2-digit' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const ev = await getPublicEvent(id)
  if (!ev) notFound()
  const tz = ev.places.cities?.timezone ?? null
  const when = `${fmtDay(ev.starts_at, tz)}, ${fmtHour(ev.starts_at, tz)} h`
  const cancelled = ev.status === 'cancelled'
  const title = `${cancelled ? 'Cancelado: ' : ''}${ev.name} — ${ev.places.name} | Goospe`
  const description = metaDescription(
    `${cancelled ? 'Evento cancelado. ' : ''}${when} en ${eventLocationText(ev.places)}.${ev.description ? ` ${ev.description}` : ''}`,
  )
  // Imagen propia del evento si la subió el dueño; si no, una tarjeta generada con sus datos.
  const image = ev.image_url || eventOgPath(ev.id)
  return {
    title,
    description,
    alternates: { canonical: eventPath(ev.id) },
    openGraph: {
      title,
      description,
      url: eventPath(ev.id),
      siteName: 'Goospe',
      type: 'article',
      images: [{ url: image, alt: ev.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

const action = 'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg'

export default async function EventPage({ params }: Props) {
  const { id } = await params
  const ev = await getPublicEvent(id)
  if (!ev) notFound()

  const place = ev.places
  const tz = place.cities?.timezone ?? null
  const phase = eventPhase(ev, Date.now())
  const open = phase === 'upcoming' || phase === 'live'
  const { data: coords } = await createAdminClient().rpc('places_lnglat', { ids: [place.id] })
  const ll = coords?.[0] ?? null

  const location = eventLocationText(place)
  const address = eventAddressText(place)
  const url = absoluteUrl(eventPath(ev.id))
  const calendar: CalendarEvent = {
    uid: `${ev.id}@goospe`,
    title: ev.name,
    description: ev.description,
    location,
    start: ev.starts_at,
    end: ev.ends_at,
    url,
  }
  const sameDayEnd = ev.ends_at && fmtDay(ev.ends_at, tz) === fmtDay(ev.starts_at, tz)
  const image = ev.image_url || place.cover_url

  const when = (
    <>
      <time dateTime={ev.starts_at} className="block font-medium first-letter:uppercase">{fmtDay(ev.starts_at, tz)}</time>
      <span className="text-fg-soft">
        {fmtHour(ev.starts_at, tz)} h
        {ev.ends_at && ` – ${sameDayEnd ? '' : `${fmtDay(ev.ends_at, tz)}, `}${fmtHour(ev.ends_at, tz)} h`}
        {place.cities && ` · hora de ${place.cities.name}`}
      </span>
    </>
  )

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      {/* portada a sangre (mismo patrón que la ficha del lugar) */}
      <div className="relative h-[380px] bg-[#121311] md:h-[500px]">
        <PhotoImg src={image} alt={ev.name} priority tone="deep"
          className={`absolute inset-0 h-full w-full object-cover ${open ? '' : 'opacity-60 grayscale'}`} isoClassName="h-16 w-16" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,9,0.85),rgba(10,10,9,0)_60%)]" />
        <div className="absolute inset-x-0 bottom-0">
          <div className={`${appContainer} pb-7 text-white md:pb-9`}>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {phase === 'live' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-goospe-green px-[11px] py-[5px] leading-none text-on-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> En curso
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-[11px] py-[5px] leading-none">
                <Clock size={13} strokeWidth={2} /> <span className="first-letter:uppercase">{fmtDay(ev.starts_at, tz)}</span> · {fmtHour(ev.starts_at, tz)} h
              </span>
              {phase === 'cancelled' && <span className="rounded-full bg-red-600 px-[11px] py-[5px] leading-none">Cancelado</span>}
              {phase === 'past' && <span className="rounded-full bg-white/[0.16] px-[11px] py-[5px] leading-none">Ya pasó</span>}
            </div>
            <div className="text-shadow-photo mt-3.5">
              <h1 className={`text-[clamp(36px,5.5vw,72px)] font-medium leading-[0.98] tracking-[-0.035em] [overflow-wrap:anywhere] ${phase === 'cancelled' ? 'line-through decoration-2' : ''}`}>{ev.name}</h1>
              <p className="mt-2.5 text-[clamp(17px,1.6vw,22px)] text-goospe-green-light">
                en <Link href={placePath(place.slug)} className="hover:underline">{place.name}</Link>{place.cities && ` · ${place.cities.name}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <article className={`${appContainer} flex-1 pb-14 pt-[18px] md:pt-7`}>
        <Breadcrumbs items={[{ label: 'Eventos', href: '/events' }, { label: place.name, href: placePath(place.slug) }, { label: ev.name }]} className="!text-[13px]" />

        {phase === 'cancelled' && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-[14px] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-fg">
            <CalendarX size={17} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span><strong className="font-medium">Evento cancelado.</strong> {place.name} canceló este evento; ya no se realizará.</span>
          </p>
        )}
        {phase === 'past' && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-fg-soft">
            <History size={17} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span><strong className="font-medium text-fg">Este evento ya pasó.</strong> Mira lo que viene en la cartelera.</span>
          </p>
        )}

        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          {/* En móvil la tarjeta práctica va primero; en web, columna fija a la derecha. */}
          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[88px] lg:col-start-2 lg:row-start-1">
            <div className="rounded-[22px] border border-line bg-card p-5">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 text-ink"><Clock size={18} strokeWidth={1.75} /><span className="sr-only">Cuándo</span></dt>
                  <dd className="text-fg">{when}</dd>
                </div>
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 text-ink"><MapPin size={18} strokeWidth={1.75} /><span className="sr-only">Dónde</span></dt>
                  <dd className="min-w-0 text-fg">
                    <Link href={placePath(place.slug)} className="inline-flex items-center gap-1 font-medium hover:text-ink">
                      {place.name} <ArrowRight size={14} strokeWidth={1.75} />
                    </Link>
                    <span className="block text-fg-soft [overflow-wrap:anywhere]">{address}</span>
                  </dd>
                </div>
              </dl>

              {/* Conteo en vivo (solo números): asistirán + desglose, e interesados aparte. */}
              {phase !== 'cancelled' && (
                <div className="mt-4 border-t border-line pt-4">
                  <EventAttendanceLive eventId={ev.id} className="text-sm text-fg-soft" />
                </div>
              )}

              {open && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className={`${eyebrow} mb-2.5`}>¿Vas?</p>
                  <RsvpButton eventId={ev.id} size="lg" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {open && (
                <>
                  <a href={googleCalendarUrl(calendar) ?? '#'} target="_blank" rel="noreferrer" className={action}>
                    <CalendarPlus size={17} strokeWidth={1.75} /> Google Calendar
                  </a>
                  <a href={eventIcsPath(ev.id)} className={action}>
                    <CalendarPlus size={17} strokeWidth={1.75} /> Agregar al calendario (.ics)
                  </a>
                </>
              )}
              {ll && phase !== 'cancelled' && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${ll.lat},${ll.lng}`} target="_blank" rel="noreferrer" className={action}>
                  <Compass size={17} strokeWidth={1.75} /> Cómo llegar
                </a>
              )}
              <EventShare eventId={ev.id} name={ev.name} text={`${ev.name} en ${place.name}`} className={action} />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-9 lg:col-start-1 lg:row-start-1">
            <section>
              <h2 className={`${eyebrow} mb-3`}>Sobre el evento</h2>
              {ev.description
                ? <p className="whitespace-pre-line text-lg leading-relaxed text-fg-soft [overflow-wrap:anywhere]">{ev.description}</p>
                : <p className="text-fg-soft">{place.name} todavía no agregó una descripción.</p>}
            </section>

            <section>
              <h2 className={`${eyebrow} mb-3`}>Dónde es</h2>
              <Link href={placePath(place.slug)} className="group flex items-center gap-4 rounded-[22px] border border-line bg-card p-4 transition hover:border-goospe-green/40">
                <PhotoImg src={place.cover_url} alt={place.name} tone="tint" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" isoClassName="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-medium text-fg">{place.name}</span>
                  <span className="block text-sm text-fg-soft [overflow-wrap:anywhere]">{address}</span>
                </span>
                <ArrowRight size={18} strokeWidth={1.75} className="shrink-0 text-muted transition group-hover:text-ink" />
              </Link>
            </section>

            <Link href="/events" className="inline-flex items-center gap-1 self-start text-sm font-medium text-ink hover:underline">
              Ver toda la cartelera <ArrowRight size={14} strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </article>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: ev.name,
          ...(ev.description ? { description: ev.description } : {}),
          startDate: new Date(ev.starts_at).toISOString(),
          endDate: new Date(eventEndMs(ev.starts_at, ev.ends_at)).toISOString(),
          eventStatus: `https://schema.org/${phase === 'cancelled' ? 'EventCancelled' : 'EventScheduled'}`,
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          url,
          image: [ev.image_url || absoluteUrl(eventOgPath(ev.id))],
          location: {
            '@type': 'Place',
            name: place.name,
            url: absoluteUrl(placePath(place.slug)),
            address: address,
            ...(ll ? { geo: { '@type': 'GeoCoordinates', latitude: ll.lat, longitude: ll.lng } } : {}),
          },
          organizer: { '@type': 'Organization', name: place.name, url: absoluteUrl(placePath(place.slug)) },
        }}
      />
      <AppFooter />
    </main>
  )
}
