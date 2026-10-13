import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveCityBySlug } from '@/lib/cities'
import type { ActiveCity } from '@/lib/city-choice'
import { getActiveCityChoice } from '@/lib/city-choice-server'
import { fmtInZone } from '@/lib/tz'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { PhotoImg } from '@/shared/components/photo-img'
import { AttendanceCounts } from '@/features/events/AttendanceCounts'
import { EventsCitySwitcher } from '@/features/events/EventsCitySwitcher'
import { RsvpButton } from '@/features/events/RsvpButton'
import { ALL_CITIES, eventsHref, parseEventsParams } from '@/features/events/event-params'
import { EVENT_WINDOWS, EVENT_WINDOW_LABEL, inEventWindow, type EventWindow } from '@/features/events/event-time'
import { fetchEventStats, listUpcomingEvents } from '@/features/events/queries'
import { eventPath, placePath } from '@/features/places/seo-routes'

// Cartelera: pestañas Hoy / Esta semana / Próximos y filtro por ciudad, con el estado en la
// URL (?when=hoy&city=puerto-varas) para poder compartirla. Sin `?city=` se muestra la ciudad
// que el visitante eligió en el selector (cookie `goospe_city`); `?city=todas` la quita. "Hoy" y "esta semana" se calculan
// en la zona horaria de la ciudad de CADA evento (la cartelera mezcla Chile y España).
// Al leer searchParams la página se renderiza por petición: la fecha siempre está al día.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
type CityOption = { slug: string; name: string }

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

// Cada evento se muestra en la hora de SU ciudad.
const fmt = (s: string, tz: string | null | undefined) =>
  fmtInZone(s, tz, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

const chip = 'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition'
const chipOn = 'border-goospe-green bg-goospe-green/10 text-goospe-green-dark'
const chipOff = 'border-line bg-card text-fg-soft hover:text-fg'

export default async function EventosPage({ searchParams }: Props) {
  const { when, city: requested, explicit, chosen } = await resolveView(searchParams)
  const filters: { when: EventWindow } = { when }
  const now = Date.now()
  const all = (await listUpcomingEvents(now)).filter((ev) => inEventWindow(ev, 'proximos', ev.places.cities?.timezone, now))

  // Ciudades con eventos vigentes (+ la que se muestra aunque hoy no tenga ninguno).
  const cityMap = new Map<string, CityOption>()
  for (const ev of all) if (ev.places.cities) cityMap.set(ev.places.cities.slug, ev.places.cities)
  if (requested) cityMap.set(requested.slug, requested)
  const cities = [...cityMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const city = requested?.slug ?? null
  // Valor de `?city=` que conserva la vista actual al cambiar de pestaña: ninguno si la ciudad
  // sale de la elección del visitante (URL limpia), y "todas" explícito si tiene una elegida.
  const allParam = chosen ? ALL_CITIES : null
  const keepParam = city ? (explicit ? city : null) : allParam
  const hrefFor = eventsHref

  const inCity = city ? all.filter((ev) => ev.places.cities?.slug === city) : all
  const byWindow = Object.fromEntries(EVENT_WINDOWS.map((w) => [
    w, inCity.filter((ev) => inEventWindow(ev, w, ev.places.cities?.timezone, now)),
  ])) as Record<EventWindow, typeof inCity>
  const events = byWindow[filters.when]
  const stats = await fetchEventStats(events.map((e) => e.id))

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <h1 className="mb-1 text-3xl font-medium text-fg">Cartelera{requested ? ` · ${requested.name}` : ''}</h1>
        <p className="mb-4 text-fg-soft">Lo que viene en los lugares cerca de ti.</p>
        {/* Ciudad del visitante: por defecto la que eligió; cambiarla navega a ?city=<slug>. */}
        <div className="mb-4">
          <EventsCitySwitcher current={requested ? { id: requested.id, name: requested.name } : null} when={filters.when} />
        </div>

        <nav aria-label="Cuándo" className="flex flex-wrap gap-2">
          {EVENT_WINDOWS.map((w) => (
            <Link key={w} href={hrefFor(w, keepParam)} scroll={false} aria-current={filters.when === w ? 'page' : undefined}
              className={`${chip} ${filters.when === w ? chipOn : chipOff}`}>
              {EVENT_WINDOW_LABEL[w]} <span className="text-xs opacity-70">{byWindow[w].length}</span>
            </Link>
          ))}
        </nav>

        {cities.length > 0 && (
          <nav aria-label="Ciudad" className="mt-3 flex flex-wrap gap-2">
            <Link href={hrefFor(filters.when, allParam)} scroll={false} aria-current={city ? undefined : 'page'} className={`${chip} ${city ? chipOff : chipOn}`}>
              Todas las ciudades
            </Link>
            {cities.map((c) => (
              <Link key={c.slug} href={hrefFor(filters.when, c.slug)} scroll={false} aria-current={city === c.slug ? 'page' : undefined}
                className={`${chip} ${city === c.slug ? chipOn : chipOff}`}>
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-80" />
            <p className="text-fg-soft">
              {filters.when === 'hoy' ? 'No hay eventos para hoy' : filters.when === 'semana' ? 'No hay eventos para esta semana' : 'Aún no hay eventos próximos'}
              {requested ? ` en ${requested.name}` : ''}. Mientras tanto, descubre lugares cerca de ti.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {filters.when !== 'proximos' && inCity.length > 0 && (
                <Link href={hrefFor('proximos', keepParam)} className={`${chip} ${chipOff}`}>Ver los próximos ({inCity.length})</Link>
              )}
              <Link href="/feed" className="inline-flex items-center gap-2 rounded-full bg-goospe-green px-5 py-2 text-sm font-medium text-white transition hover:bg-goospe-green-dark">
                Explorar lugares
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {events.map((ev) => {
              const tz = ev.places.cities?.timezone
              const s = stats[ev.id]
              return (
                <li key={ev.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                  <div className="flex">
                    <Link href={eventPath(ev.id)} className="shrink-0" aria-hidden tabIndex={-1}>
                      <PhotoImg src={ev.image_url ?? ev.places.cover_url} alt="" className="h-full min-h-32 w-28 object-cover sm:w-36" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                      <p className="text-xs font-medium text-goospe-green first-letter:uppercase">
                        <time dateTime={ev.starts_at}>{fmt(ev.starts_at, tz)}</time> h
                      </p>
                      <h2 className="font-medium text-fg [overflow-wrap:anywhere]">
                        <Link href={eventPath(ev.id)} className="hover:text-goospe-green">{ev.name}</Link>
                      </h2>
                      <p className="text-sm text-fg-soft">
                        en <Link href={placePath(ev.places.slug)} className="hover:text-goospe-green">{ev.places.name}</Link>
                        {!city && ev.places.cities && ` · ${ev.places.cities.name}`}
                      </p>
                      {ev.description && <p className="line-clamp-2 text-sm text-fg-soft">{ev.description}</p>}
                      {s && <AttendanceCounts {...s} className="text-sm text-fg-soft" />}
                      <div className="mt-2">
                        <RsvpButton eventId={ev.id} />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
