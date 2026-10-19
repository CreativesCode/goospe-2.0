import type { Metadata } from 'next'
import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { getActiveCityBySlug } from '@/lib/cities'
import type { ActiveCity } from '@/lib/city-choice'
import { getActiveCityChoice } from '@/lib/city-choice-server'
import { fmtInZone } from '@/lib/tz'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { PhotoImg } from '@/shared/components/photo-img'
import { appContainer, pageTitle } from '@/shared/lib/ui'
import { AttendanceCounts } from '@/features/events/AttendanceCounts'
import { EventsCitySwitcher } from '@/features/events/EventsCitySwitcher'
import { RsvpButton } from '@/features/events/RsvpButton'
import { ALL_CITIES, eventsHref, parseEventsParams } from '@/features/events/event-params'
import { EVENT_WINDOWS, EVENT_WINDOW_LABEL, addDays, inEventWindow, localDay, type EventWindow } from '@/features/events/event-time'
import { fetchEventStats, listUpcomingEvents } from '@/features/events/queries'
import { eventPath, placePath } from '@/features/places/seo-routes'

// Cartelera: pestañas Hoy / Esta semana / Próximos y filtro por ciudad, con el estado en la
// URL (?when=hoy&city=puerto-varas) para poder compartirla. Sin `?city=` se muestra la ciudad
// que el visitante eligió en el selector (cookie `goospe_city`); `?city=todas` la quita. "Hoy" y "esta semana" se calculan
// en la zona horaria de la ciudad de CADA evento (la cartelera mezcla Chile y España).
// Al leer searchParams la página se renderiza por petición: la fecha siempre está al día.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
type UpcomingEvent = Awaited<ReturnType<typeof listUpcomingEvents>>[number]

/**
 * Qué ciudad muestra la cartelera:
 *  · `?city=<slug>`  → esa ciudad, si está activa (si no, todas);
 *  · `?city=todas`   → todas, aunque el visitante tenga una ciudad elegida;
 *  · sin `?city=`    → la ciudad elegida por el visitante (cookie validada), o todas.
 * `chosen` = ciudad elegida y vigente del visitante (decide si "todas" necesita `?city=todas`).
 */
async function resolveView(searchParams: Props['searchParams']) {
  const filters = parseEventsParams(await searchParams)
  const chosen = await getActiveCityChoice()
  const explicit = filters.city !== null
  const city: ActiveCity | null = filters.city === null ? chosen
    : filters.city === ALL_CITIES ? null
    : await getActiveCityBySlug(filters.city)
  return { when: filters.when, city, explicit, chosen }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { when, city } = await resolveView(searchParams)
  const cityName = city?.name ?? null
  const scope = when === 'hoy' ? 'hoy' : when === 'semana' ? 'esta semana' : null
  const title = `Eventos${scope ? ` ${scope}` : ''}${cityName ? ` en ${cityName}` : ' cerca de ti'} | Goospe`
  return {
    title,
    description: `Qué hacer ${scope ?? 'estos días'}${cityName ? ` en ${cityName}` : ' cerca de ti'}: conciertos, ferias y panoramas. Marca los que te interesan o confirma tu asistencia con un toque.`,
    // Las pestañas son vistas de la misma cartelera: la canónica solo distingue la ciudad.
    alternates: { canonical: eventsHref('proximos', city?.slug ?? null) },
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type DayGroup = { key: string; num: string; label: string; month: string; items: UpcomingEvent[] }

/**
 * Agrupa por día civil. Cada evento se sitúa en el día y la hora de SU ciudad; "hoy" y "mañana"
 * también se calculan en esa zona (un mismo instante puede ser días distintos en Chile y España).
 */
function groupByDay(events: UpcomingEvent[], now: number): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const ev of events) {
    const tz = ev.places.cities?.timezone
    const key = localDay(ev.starts_at, tz)
    let group = groups.get(key)
    if (!group) {
      const today = localDay(now, tz)
      const weekday = fmtInZone(ev.starts_at, tz, { weekday: 'long' })
      const label = key <= today ? `Hoy, ${weekday}` : key === addDays(today, 1) ? `Mañana, ${weekday}` : capital(weekday)
      group = { key, num: String(Number(key.slice(8, 10))), label, month: fmtInZone(ev.starts_at, tz, { month: 'long' }), items: [] }
      groups.set(key, group)
    }
    group.items.push(ev)
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

const outlineBtn = 'inline-flex h-11 items-center rounded-full border border-line bg-card px-5 text-sm font-medium text-fg transition hover:border-goospe-green/50'

export default async function EventosPage({ searchParams }: Props) {
  const { when, city: requested, explicit, chosen } = await resolveView(searchParams)
  const now = Date.now()
  const all = (await listUpcomingEvents(now)).filter((ev) => inEventWindow(ev, 'proximos', ev.places.cities?.timezone, now))

  const city = requested?.slug ?? null
  // Valor de `?city=` que conserva la vista actual al cambiar de pestaña: ninguno si la ciudad
  // sale de la elección del visitante (URL limpia), y "todas" explícito si tiene una elegida.
  const allParam = chosen ? ALL_CITIES : null
  const keepParam = city ? (explicit ? city : null) : allParam

  const inCity = city ? all.filter((ev) => ev.places.cities?.slug === city) : all
  const byWindow = Object.fromEntries(EVENT_WINDOWS.map((w) => [
    w, inCity.filter((ev) => inEventWindow(ev, w, ev.places.cities?.timezone, now)),
  ])) as Record<EventWindow, typeof inCity>
  const events = byWindow[when]
  const stats = await fetchEventStats(events.map((e) => e.id))
  const days = groupByDay(events, now)

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className={`${appContainer} pb-14 pt-[18px] md:pt-7`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={pageTitle}>Cartelera</h1>
            <p className="mt-1">Lo que viene en {requested ? requested.name : 'los lugares cerca de ti'}.</p>
          </div>
          {/* Ciudad del visitante: por defecto la que eligió; cambiarla navega a ?city=<slug>. */}
          <EventsCitySwitcher current={requested ? { id: requested.id, name: requested.name } : null} when={when} />
        </div>

        <nav aria-label="Cuándo" className="no-scrollbar mt-[22px] flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-card p-1">
          {EVENT_WINDOWS.map((w) => (
            <Link
              key={w}
              href={eventsHref(w, keepParam)}
              scroll={false}
              aria-current={when === w ? 'page' : undefined}
              className={`flex h-[38px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${when === w ? 'bg-goospe-green text-on-brand' : 'text-fg-soft hover:text-fg'}`}
            >
              {EVENT_WINDOW_LABEL[w]} <span className="text-xs opacity-70">{byWindow[w].length}</span>
            </Link>
          ))}
        </nav>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-80" />
            <p className="max-w-md text-fg-soft">
              {when === 'hoy' ? 'No hay eventos para hoy' : when === 'semana' ? 'No hay eventos para esta semana' : 'Aún no hay eventos próximos'}
              {requested ? ` en ${requested.name}` : ''}. Mientras tanto, descubre lugares cerca de ti.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {when !== 'proximos' && inCity.length > 0 && (
                <Link href={eventsHref('proximos', keepParam)} className={outlineBtn}>Ver los próximos ({inCity.length})</Link>
              )}
              {requested && all.length > inCity.length && (
                <Link href={eventsHref(when, allParam)} className={outlineBtn}>Ver todas las ciudades</Link>
              )}
              <Link href="/feed" className="inline-flex h-11 items-center rounded-full bg-goospe-green px-5 text-sm font-medium text-on-brand transition hover:brightness-105">
                Explorar lugares
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-7 flex flex-col gap-8">
            {days.map((d) => (
              <section key={d.key} className="grid gap-x-7 gap-y-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                <h2 className="flex items-baseline gap-2.5 self-start lg:sticky lg:top-[88px]">
                  <span className="text-[44px] font-light leading-none tracking-[-0.03em] text-fg">{d.num}</span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{d.label}</span>
                    <span className="block text-[13px] font-normal text-muted">{d.month}</span>
                  </span>
                </h2>
                <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                  {d.items.map((ev) => {
                    const tz = ev.places.cities?.timezone
                    const s = stats[ev.id]
                    return (
                      <li key={ev.id} className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-card">
                        <Link href={eventPath(ev.id)} className="relative block h-[150px] shrink-0" aria-hidden tabIndex={-1}>
                          <PhotoImg src={ev.image_url ?? ev.places.cover_url} alt="" className="h-full w-full object-cover" fallback={<Ticket size={38} strokeWidth={1.5} />} />
                          <span className="absolute left-3 top-3 rounded-full bg-[#1C1C1A] px-2.5 py-[5px] text-xs font-medium leading-none text-white">
                            <time dateTime={ev.starts_at}>{fmtInZone(ev.starts_at, tz, { hour: '2-digit', minute: '2-digit' })}</time> h
                          </span>
                        </Link>
                        <div className="flex flex-1 flex-col gap-1 px-[18px] pb-[18px] pt-4">
                          <h3 className="text-[17px] font-medium text-fg [overflow-wrap:anywhere]">
                            <Link href={eventPath(ev.id)} className="hover:text-ink">{ev.name}</Link>
                          </h3>
                          <p className="text-sm">
                            en <Link href={placePath(ev.places.slug)} className="text-ink hover:underline">{ev.places.name}</Link>
                            {!city && ev.places.cities && ` · ${ev.places.cities.name}`}
                          </p>
                          {s && <AttendanceCounts {...s} className="text-[13px] text-muted" />}
                          <div className="mt-auto pt-3">
                            <RsvpButton eventId={ev.id} fill />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
