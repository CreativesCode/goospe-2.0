import { RsvpButton } from '@/features/events/RsvpButton'
import { AttendanceCounts } from '@/features/events/AttendanceCounts'
import { PhotoGallery } from '@/features/photos/PhotoGallery'
import { PhotoUpload } from '@/features/photos/PhotoUpload'
import { DetailTracker } from '@/features/places/DetailTracker'
import { DirectionsLink } from '@/features/places/DirectionsLink'
import { ContactLink } from '@/features/places/ContactLink'
import { OpenNowBadge } from '@/features/places/OpenNowBadge'
import { PlaceActions } from '@/features/places/PlaceActions'
import { PlaceReviews } from '@/features/reviews/PlaceReviews'
import { SuggestCorrection } from '@/features/feedback/SuggestCorrection'
import { humanizeHours } from '@/lib/hours'
import { fmtInZone } from '@/lib/tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { BackButton } from '@/shared/components/back-button'
import { Breadcrumbs, type Crumb } from '@/shared/components/breadcrumbs'
import { PhotoImg } from '@/shared/components/photo-img'
import { categoryIcon } from '@/shared/lib/icons'
import { fetchEventStats } from '@/features/events/queries'
import { getRelatedPlaces } from '@/features/places/listings'
import { PlaceCard } from '@/features/places/PlaceCard'
import { placeCategories, placeCity, placePhotos, type PlaceRecord } from '@/features/places/place-data'
import { cityCategoryPath, cityPath, eventPath } from '@/features/places/seo-routes'
import Link from 'next/link'
import { BadgeCheck, ArrowRight, EyeOff } from 'lucide-react'

// Hora del evento en la zona de la CIUDAD del lugar (no la del servidor ni la del visitante).
const fmtEventDate = (s: string, tz: string | null) =>
  fmtInZone(s, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function igUrl(handle: string) {
  const h = handle.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  return { label: `@${h}`, url: `https://instagram.com/${h}` }
}
function webUrl(w: string) {
  return w.startsWith('http') ? w : `https://${w}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-32 shrink-0 text-muted">{label}</dt>
      {/* min-w-0 + anywhere: una URL larga sin espacios ya no desborda la ficha en móvil */}
      <dd className="min-w-0 flex-1 text-fg [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/**
 * Cuerpo de la ficha de un lugar. Lo usan la ficha pública (/places/[slug], ISR) y la vista
 * previa del dueño o del equipo (/places/[slug]/preview) cuando el lugar no está publicado.
 * En vista previa no se registra la visita (no debe contar en las estadísticas del negocio).
 */
export async function PlaceView({ place, preview = false }: { place: PlaceRecord; preview?: boolean }) {
  const sb = createAdminClient()
  // events, coords y relacionados son independientes entre sí → en paralelo.
  const [{ data: events }, { data: coords }, related] = await Promise.all([
    sb.from('events')
      .select('id, name, description, image_url, starts_at, ends_at')
      .eq('place_id', place.id)
      .eq('status', 'approved')
      .gte('starts_at', new Date(Date.now() - 86400_000).toISOString())
      .order('starts_at'),
    sb.rpc('places_lnglat', { ids: [place.id] }),
    preview ? Promise.resolve([]) : getRelatedPlaces(place.id),
  ])
  const upcoming = events ?? []
  // Conteos agregados por evento (solo números, sin PII).
  const eventStats = await fetchEventStats(upcoming.map((e) => e.id))
  const ll = coords?.[0]
  // Solo fotos APROBADAS: la consulta va con service role (salta la RLS), así que el filtro
  // tiene que estar aquí. Antes se colaban las pendientes de moderación.
  const photos = placePhotos(place).filter((ph) => ph.status === 'approved')
  // La portada que subió el dueño va primero en la galería (sin repetirla si ya es una foto suya).
  const gallery = place.cover_url
    ? [{ id: 'cover', url: place.cover_url }, ...photos.filter((ph) => ph.url !== place.cover_url)]
    : photos
  const city = placeCity(place)
  const tz = city?.timezone ?? null
  const cats = placeCategories(place)
  // Miga de pan: enlaces internos a los listados de la ciudad y de la categoría.
  const crumbs: Crumb[] = [
    { label: 'Lugares', href: '/places' },
    ...(city ? [{ label: city.name, href: cityPath(city.slug) }] : []),
    ...(city && cats[0] ? [{ label: cats[0].name, href: cityCategoryPath(city.slug, cats[0].slug) }] : []),
    { label: place.name },
  ]
  const addr = place.address as { street?: string; number?: string; city?: string; formatted?: string } | null
  const hours = place.hours as { osm_raw?: string } | null
  const menu = place.menu as { sections?: { name: string; items: { name: string; price: string | null; description: string | null }[] }[] } | null

  const PlaceCat = categoryIcon(cats[0]?.emoji)
  const noPhotos = (
    <div className="flex aspect-[16/6] flex-col items-center justify-center gap-2 rounded-2xl bg-goospe-gradient text-center text-white">
      <PlaceCat size={44} strokeWidth={1.4} />
      <p className="text-sm text-white/90">Sé el primero en aportar una foto de este lugar</p>
    </div>
  )

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      {!preview && <DetailTracker placeId={place.id} />}
      <AppNav />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <BackButton />
          <Breadcrumbs items={crumbs} className="min-w-0" />
        </div>

        {/* Vista previa de un lugar oculto: solo la ven su dueño y el equipo; el público recibe un 404. */}
        {preview && (
          <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
            <EyeOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>Vista previa: este lugar no está publicado. Solo tú y el equipo de Goospe pueden verlo; para el resto no existe.</span>
          </p>
        )}

        {/* título */}
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-3 text-sm text-fg-soft">
            {cats.map((c) => {
              const Cat = categoryIcon(c.emoji)
              return <span key={c.slug} className="inline-flex items-center gap-1"><Cat size={14} strokeWidth={1.75} /> {c.name}</span>
            })}
          </div>
          <div className="flex items-center gap-3">
            {place.logo_url && (
              <PhotoImg src={place.logo_url} alt={`Logo de ${place.name}`} className="h-14 w-14 shrink-0 rounded-full border border-line object-cover" isoClassName="h-6 w-6" />
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-medium text-fg [overflow-wrap:anywhere]">{place.name}</h1>
              {place.vibe_line && <p className="mt-1 text-lg font-medium text-goospe-green">{place.vibe_line}</p>}
            </div>
          </div>
          <OpenNowBadge hours={hours} timezone={tz} tone="surface" className="mt-2" />
        </div>

        {/* precio + acciones: guardar / cómo llegar / compartir (registran interacciones) */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          {place.price_level && (
            <span className="text-lg font-medium">
              <span className="text-fg">{'$'.repeat(place.price_level)}</span>
              <span className="text-muted/50">{'$'.repeat(4 - place.price_level)}</span>
            </span>
          )}
          <PlaceActions
            placeId={place.id}
            slug={place.slug}
            name={place.name}
            vibeLine={place.vibe_line}
            lat={ll?.lat ?? null}
            lng={ll?.lng ?? null}
          />
        </div>

        {/* CTA de reclamo: solo si el lugar aún no tiene dueño */}
        {!place.claimed && !place.business_id && (
          <Link
            href={`/panel/claim?q=${encodeURIComponent(place.name)}`}
            className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-goospe-green/30 bg-goospe-green/5 px-5 py-4 transition hover:border-goospe-green/60 hover:bg-goospe-green/10"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-goospe-green/15 text-goospe-green">
                <BadgeCheck size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-fg">¿Este es tu negocio?</span>
                <span className="block text-sm text-fg-soft">Reclámalo para editar tu ficha, publicar eventos y ver tus estadísticas.</span>
              </span>
            </span>
            <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-goospe-green-dark sm:inline-flex">
              Reclamar <ArrowRight size={15} strokeWidth={1.75} />
            </span>
          </Link>
        )}

        {/* fotos */}
        <section className="mb-8">
          {/* `empty` cubre también el caso "hay fotos pero ninguna cargó" (Google caído). */}
          <PhotoGallery photos={gallery} alt={place.name} empty={noPhotos} />
          <PhotoUpload placeId={place.id} />
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {/* descripción + tags */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Resumen (IA)</h2>
            <p className="text-fg-soft">{place.description ?? '—'}</p>
            {place.tags && place.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {place.tags.map((t) => (
                  <span key={t} className="rounded-full bg-goospe-green/10 px-2.5 py-1 text-xs text-goospe-green-dark">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* datos */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Datos</h2>
            <dl className="divide-y divide-line">
              <Field label="Dirección">{addr?.formatted ?? ([addr?.street, addr?.number].filter(Boolean).join(' ') || null)}</Field>
              <Field label="Ciudad">{addr?.city}</Field>
              <Field label="Teléfono">
                {place.phone && <ContactLink placeId={place.id} channel="phone" value={place.phone} />}
              </Field>
              <Field label="WhatsApp">
                {place.whatsapp && <ContactLink placeId={place.id} channel="whatsapp" value={place.whatsapp} />}
              </Field>
              <Field label="Web">
                {place.website && <a href={webUrl(place.website)} target="_blank" rel="noreferrer" className="text-goospe-green hover:underline">{place.website}</a>}
              </Field>
              <Field label="Instagram">
                {place.instagram && (
                  <a href={igUrl(place.instagram).url} target="_blank" rel="noreferrer" className="text-goospe-green hover:underline">
                    {igUrl(place.instagram).label}
                  </a>
                )}
              </Field>
              <Field label="Email">
                {place.email && <ContactLink placeId={place.id} channel="email" value={place.email} />}
              </Field>
              <Field label="Horario">
                {(() => {
                  const lines = humanizeHours(hours?.osm_raw)
                  if (lines) return <span className="space-y-0.5">{lines.map((l, i) => <span key={i} className="block">{l}</span>)}</span>
                  return hours?.osm_raw ?? null
                })()}
              </Field>
            </dl>
          </section>
        </div>

        {/* menú */}
        {menu?.sections && menu.sections.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">Carta</h2>
            <div className="space-y-5">
              {menu.sections.map((sec, i) => (
                <div key={i}>
                  <h3 className="mb-2 font-medium text-goospe-green-dark">{sec.name}</h3>
                  <ul className="divide-y divide-line">
                    {sec.items.map((it, j) => (
                      <li key={j} className="flex items-baseline justify-between gap-4 py-1.5">
                        <div className="min-w-0">
                          <span className="text-sm text-fg">{it.name}</span>
                          {it.description && <span className="ml-2 text-xs text-muted">{it.description}</span>}
                        </div>
                        {it.price && <span className="shrink-0 text-sm font-medium text-fg">{it.price}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* mapa */}
        {ll && (
          <section className="mt-8">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Ubicación</h2>
            <div className="overflow-hidden rounded-2xl border border-line">
              <iframe
                title="Mapa"
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${ll.lng - 0.004}%2C${ll.lat - 0.0025}%2C${ll.lng + 0.004}%2C${ll.lat + 0.0025}&layer=mapnik&marker=${ll.lat}%2C${ll.lng}`}
              />
            </div>
            <DirectionsLink placeId={place.id} lat={ll.lat} lng={ll.lng} className="mt-2 inline-flex items-center gap-1.5 text-sm text-goospe-green hover:underline" />

          </section>
        )}

        {/* eventos */}
        {upcoming.length > 0 && (
          <section className="mt-10 border-t border-line pt-8">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-muted">Próximos eventos</h2>
            <ul className="space-y-3">
              {upcoming.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-4 shadow-sm">
                  {ev.image_url && (
                    <PhotoImg src={ev.image_url} alt={ev.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" isoClassName="h-7 w-7" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase text-goospe-green">{fmtEventDate(ev.starts_at, tz)}</p>
                    <h3 className="font-medium text-fg">
                      <Link href={eventPath(ev.id)} className="hover:text-goospe-green">{ev.name}</Link>
                    </h3>
                    {ev.description && <p className="line-clamp-1 text-sm text-fg-soft">{ev.description}</p>}
                    {eventStats[ev.id] && <AttendanceCounts {...eventStats[ev.id]} className="mt-1 text-fg-soft" />}
                  </div>
                  <RsvpButton eventId={ev.id} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* reseñas */}
        <PlaceReviews placeId={place.id} />

        {/* sugerir una corrección de la ficha (llega a /admin/feedback y al dueño) */}
        <div className="mt-8"><SuggestCorrection placeId={place.id} placeName={place.name} /></div>

        {/* lugares relacionados: misma categoría, cerca y parecidos (RPC related_places) */}
        {related.length > 0 && (
          <section className="mt-10 border-t border-line pt-8">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Lugares relacionados</h2>
              {city && (
                <Link href={cats[0] ? cityCategoryPath(city.slug, cats[0].slug) : cityPath(city.slug)} className="inline-flex items-center gap-1 text-sm text-goospe-green hover:underline">
                  Ver más en {city.name} <ArrowRight size={14} strokeWidth={1.75} />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => <PlaceCard key={p.id} place={p} />)}
            </div>
          </section>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
