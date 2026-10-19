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
import { appContainer, eyebrow } from '@/shared/lib/ui'
import { fetchEventStats } from '@/features/events/queries'
import { getRelatedPlaces } from '@/features/places/listings'
import { PlaceCard } from '@/features/places/PlaceCard'
import { placeCategories, placeCity, placePhotos, type PlaceRecord } from '@/features/places/place-data'
import { cityCategoryPath, cityPath, eventPath } from '@/features/places/seo-routes'
import Link from 'next/link'
import { BadgeCheck, ArrowRight, EyeOff, Sparkles, MapPin, Clock, Phone, MessageCircle, Globe, AtSign, Mail, type LucideIcon } from 'lucide-react'

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

/** Fila de la tarjeta de datos: icono + valor. No pinta nada si el dato falta. */
function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div className="flex gap-3 border-b border-line py-2.5 last:border-0">
      <dt className="mt-0.5 shrink-0 text-muted"><Icon size={15} strokeWidth={1.75} aria-hidden /><span className="sr-only">{label}</span></dt>
      {/* min-w-0 + anywhere: una URL larga sin espacios no desborda la tarjeta */}
      <dd className="min-w-0 flex-1 text-fg [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

const extLink = 'text-ink hover:underline'

/**
 * Cuerpo de la ficha de un lugar. Lo usan la ficha pública (/places/[slug], ISR) y la vista
 * previa del dueño o del equipo (/places/[slug]/preview) cuando el lugar no está publicado.
 * En vista previa no se registra la visita (no debe contar en las estadísticas del negocio).
 * Layout: portada a sangre con el nombre y las acciones, y debajo el contenido en dos columnas
 * (lectura a la izquierda, tarjeta de datos sticky a la derecha desde 1100 px).
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
  const address = addr?.formatted ?? ([addr?.street, addr?.number].filter(Boolean).join(' ') || null)
  const hourLines = humanizeHours(hours?.osm_raw)

  const PlaceCat = categoryIcon(cats[0]?.emoji)
  const noPhotos = (
    <div className="flex aspect-[16/6] flex-col items-center justify-center gap-2 rounded-[20px] bg-tint text-center text-goospe-green">
      <PlaceCat size={40} strokeWidth={1.4} />
      <p className="text-sm text-fg-soft">Sé el primero en aportar una foto de este lugar</p>
    </div>
  )

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      {!preview && <DetailTracker placeId={place.id} />}
      <AppNav />

      {/* portada a sangre */}
      <div className="relative h-[440px] bg-[#121311] md:h-[560px]">
        <PhotoImg
          src={gallery[0]?.url}
          alt={place.name}
          priority
          tone="deep"
          className="absolute inset-0 h-full w-full object-cover pb-[90px] [&:is(img)]:pb-0"
          fallback={<PlaceCat size={96} strokeWidth={1.1} />}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,9,0.85),rgba(10,10,9,0)_60%)]" />
        <div className="absolute inset-x-0 bottom-0">
          <div className={`${appContainer} flex flex-wrap items-end justify-between gap-5 pb-7 text-white md:pb-9`}>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <OpenNowBadge hours={hours} timezone={tz} />
                {cats.map((c) => {
                  const Cat = categoryIcon(c.emoji)
                  return (
                    <span key={c.slug} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-[11px] py-[5px] leading-none">
                      <Cat size={13} strokeWidth={2} /> {c.name}
                    </span>
                  )
                })}
              </div>
              <div className="text-shadow-photo mt-3.5 flex items-end gap-3.5">
                {place.logo_url && (
                  <PhotoImg src={place.logo_url} alt={`Logo de ${place.name}`} className="h-14 w-14 shrink-0 rounded-full border border-white/30 object-cover" isoClassName="h-6 w-6" />
                )}
                <div className="min-w-0">
                  <h1 className="text-[clamp(40px,6vw,80px)] font-medium leading-[0.95] tracking-[-0.035em] [overflow-wrap:anywhere]">{place.name}</h1>
                  {place.vibe_line && <p className="mt-2.5 text-[clamp(17px,1.6vw,22px)] text-goospe-green-light">{place.vibe_line}</p>}
                </div>
              </div>
            </div>
            <PlaceActions
              placeId={place.id}
              slug={place.slug}
              name={place.name}
              vibeLine={place.vibe_line}
              lat={ll?.lat ?? null}
              lng={ll?.lng ?? null}
            />
          </div>
        </div>
      </div>

      {/* pb extra en móvil: la barra de acciones fija no tapa el final del contenido */}
      <div className={`${appContainer} pb-[88px] pt-[18px] md:pb-16 md:pt-7`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <BackButton className="!text-[13px]" />
          <span className="text-[13px] text-muted">·</span>
          <Breadcrumbs items={crumbs} className="min-w-0 !text-[13px]" />
        </div>

        {/* Vista previa de un lugar oculto: solo la ven su dueño y el equipo; el público recibe un 404. */}
        {preview && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-[14px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
            <EyeOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>Vista previa: este lugar no está publicado. Solo tú y el equipo de Goospe pueden verlo; para el resto no existe.</span>
          </p>
        )}

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-9">
            {/* resumen + etiquetas */}
            <section>
              <h2 className={`${eyebrow} flex items-center gap-1.5`}><Sparkles size={13} strokeWidth={1.75} className="text-goospe-green" /> Resumen</h2>
              <p className="mt-2.5 text-pretty text-[17px] leading-[1.6] text-fg">{place.description ?? '—'}</p>
              {place.tags && place.tags.length > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {place.tags.map((t) => (
                    <span key={t} className="rounded-full bg-tint px-[11px] py-[5px] text-[13px] text-ink">{t}</span>
                  ))}
                </div>
              )}
            </section>

            {/* fotos */}
            <section>
              <h2 className={`${eyebrow} mb-3`}>Fotos</h2>
              {/* `empty` cubre también el caso "hay fotos pero ninguna cargó" (Google caído). */}
              <PhotoGallery photos={gallery} alt={place.name} empty={noPhotos} />
              <PhotoUpload placeId={place.id} />
            </section>

            {/* carta */}
            {menu?.sections && menu.sections.length > 0 && (
              <section>
                <h2 className={eyebrow}>Carta</h2>
                <div className="mt-3 space-y-6">
                  {menu.sections.map((sec, i) => (
                    <div key={i}>
                      <h3 className="mb-1 text-sm font-medium text-ink">{sec.name}</h3>
                      <ul className="grid gap-x-8 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                        {sec.items.map((it, j) => (
                          <li key={j} className="flex justify-between gap-3 border-b border-line py-2.5">
                            <div className="min-w-0">
                              <div className="text-[15px] text-fg">{it.name}</div>
                              {it.description && <div className="text-[13px] text-muted">{it.description}</div>}
                            </div>
                            {it.price && <span className="shrink-0 text-[15px] font-medium text-fg">{it.price}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* eventos */}
            {upcoming.length > 0 && (
              <section>
                <h2 className={`${eyebrow} mb-3`}>Próximos eventos</h2>
                <ul className="space-y-3">
                  {upcoming.map((ev) => (
                    <li key={ev.id} className="flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-card p-4">
                      {ev.image_url && (
                        <PhotoImg src={ev.image_url} alt={ev.name} className="h-16 w-16 shrink-0 rounded-[14px] object-cover" isoClassName="h-7 w-7" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase text-ink">{fmtEventDate(ev.starts_at, tz)}</p>
                        <h3 className="font-medium text-fg">
                          <Link href={eventPath(ev.id)} className="hover:text-ink">{ev.name}</Link>
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
          </div>

          {/* columna de datos */}
          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[88px]">
            <div className="rounded-[22px] border border-line bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                {place.price_level ? (
                  <span className="text-xl font-medium" aria-label={`Precio: ${place.price_level} de 4`}>
                    <span className="text-fg">{'$'.repeat(place.price_level)}</span>
                    <span className="text-line">{'$'.repeat(4 - place.price_level)}</span>
                  </span>
                ) : <span />}
                <OpenNowBadge hours={hours} timezone={tz} tone="surface" />
              </div>
              {ll && (
                <>
                  <div className="mt-3.5 overflow-hidden rounded-[14px] bg-ph">
                    <iframe
                      title={`Mapa de ${place.name}`}
                      className="h-[150px] w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${ll.lng - 0.004}%2C${ll.lat - 0.0025}%2C${ll.lng + 0.004}%2C${ll.lat + 0.0025}&layer=mapnik&marker=${ll.lat}%2C${ll.lng}`}
                    />
                  </div>
                  <DirectionsLink placeId={place.id} lat={ll.lat} lng={ll.lng} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:underline" />
                </>
              )}
              <dl className="mt-2 text-sm">
                <Fact icon={MapPin} label="Dirección">
                  {(address || addr?.city) && <>{address}{address && addr?.city ? ', ' : ''}{addr?.city}</>}
                </Fact>
                <Fact icon={Clock} label="Horario">
                  {hourLines
                    ? <span className="space-y-0.5">{hourLines.map((l, i) => <span key={i} className="block">{l}</span>)}</span>
                    : hours?.osm_raw ?? null}
                </Fact>
                <Fact icon={Phone} label="Teléfono">
                  {place.phone && <ContactLink placeId={place.id} channel="phone" value={place.phone} />}
                </Fact>
                <Fact icon={MessageCircle} label="WhatsApp">
                  {place.whatsapp && <ContactLink placeId={place.id} channel="whatsapp" value={place.whatsapp} />}
                </Fact>
                <Fact icon={Globe} label="Web">
                  {place.website && <a href={webUrl(place.website)} target="_blank" rel="noreferrer" className={extLink}>{place.website}</a>}
                </Fact>
                <Fact icon={AtSign} label="Instagram">
                  {place.instagram && (
                    <a href={igUrl(place.instagram).url} target="_blank" rel="noreferrer" className={extLink}>{igUrl(place.instagram).label}</a>
                  )}
                </Fact>
                <Fact icon={Mail} label="Email">
                  {place.email && <ContactLink placeId={place.id} channel="email" value={place.email} />}
                </Fact>
              </dl>
            </div>

            {/* CTA de reclamo: solo si el lugar aún no tiene dueño */}
            {!place.claimed && !place.business_id && (
              <Link
                href={`/panel/claim?q=${encodeURIComponent(place.name)}`}
                className="flex items-center gap-3 rounded-[18px] border border-dashed border-line px-[18px] py-4 transition hover:border-goospe-green/60"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-tint text-ink">
                  <BadgeCheck size={18} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">¿Es tu negocio?</span>
                  <span className="block text-[13px] text-fg-soft">Reclámalo y edita tu ficha.</span>
                </span>
                <ArrowRight size={16} strokeWidth={1.75} className="shrink-0 text-ink" />
              </Link>
            )}

            {/* sugerir una corrección de la ficha (llega a /admin/feedback y al dueño) */}
            <SuggestCorrection placeId={place.id} placeName={place.name} />
          </aside>
        </div>

        {/* lugares relacionados: misma categoría, cerca y parecidos (RPC related_places) */}
        {related.length > 0 && (
          <section className="mt-12 border-t border-line pt-8">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={eyebrow}>Lugares relacionados</h2>
              {city && (
                <Link href={cats[0] ? cityCategoryPath(city.slug, cats[0].slug) : cityPath(city.slug)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
                  Ver más en {city.name} <ArrowRight size={14} strokeWidth={1.75} />
                </Link>
              )}
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
              {related.map((p) => <PlaceCard key={p.id} place={p} />)}
            </div>
          </section>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
