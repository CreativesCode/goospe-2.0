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
import { humanizeHours } from '@/lib/hours'
import { fmtInZone } from '@/lib/tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { BackButton } from '@/shared/components/back-button'
import { PhotoImg } from '@/shared/components/photo-img'
import { categoryIcon } from '@/shared/lib/icons'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BadgeCheck, ArrowRight } from 'lucide-react'

// Select completo de la ficha. `cache()` dedupe la consulta dentro del mismo request:
// `generateMetadata` y el render de la página comparten UNA sola query (antes eran dos).
const PLACE_SELECT =
  'id, slug, name, address, phone, whatsapp, website, instagram, email, hours, price_level, description, vibe_line, tags, menu, ai_enriched_at, embedding_model, source, claimed, business_id, is_published, cover_url, logo_url, created_at, updated_at, place_photos(id, url, status, source, storage_path), place_categories(categories(emoji, name, slug)), cities(timezone)'

const getPlace = cache(async (slug: string) => {
  const sb = createAdminClient()
  const { data } = await sb.from('places').select(PLACE_SELECT).eq('slug', slug).maybeSingle()
  return data
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPlace(slug)
  if (!data) return { title: 'Lugar — Goospe' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photo: string | undefined = data.cover_url || ((data as any).place_photos ?? []).find((p: any) => p.status === 'approved')?.url
  // Ciudad real del propio lugar (dinámica), no una fija; si no hay, copy sin ciudad.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const city = ((data as any).address?.city as string | undefined)?.trim() || null
  const title = city ? `${data.name} — ${city} | Goospe` : `${data.name} | Goospe`
  const description = data.vibe_line || data.description ||
    (city ? `Descubre ${data.name} en ${city} con Goospe.` : `Descubre ${data.name} con Goospe.`)
  // Foto de la ficha como imagen de compartir. El proxy /api/place-photo sirve a 800px por
  // defecto; pedimos 1200px para una tarjeta OG nítida. Si no hay foto aprobada, omitimos
  // `images` y Next usa la imagen de marca por defecto (src/app/opengraph-image.tsx).
  const ogPhoto = ogPhotoUrl(photo)
  return {
    title,
    description,
    alternates: { canonical: `/places/${slug}` },
    openGraph: {
      title,
      description,
      siteName: 'Goospe',
      type: 'website',
      ...(ogPhoto ? { images: [{ url: ogPhoto, alt: data.name }] } : {}),
    },
  }
}

// La URL guardada ya trae su propio `w`: se REEMPLAZA (antes se añadía un segundo `&w=`).
function ogPhotoUrl(photo: string | undefined): string | undefined {
  if (!photo?.startsWith('/api/place-photo')) return photo
  const u = new URL(photo, 'http://local')
  u.searchParams.set('w', '1200')
  return `${u.pathname}?${u.searchParams.toString()}`
}

// Hora del evento en la zona de la CIUDAD del lugar (no la del servidor ni la del visitante).
const fmtEventDate = (s: string, tz: string | null) =>
  fmtInZone(s, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// ISR: la ficha es casi estática (contenido IA + datos del lugar). Se regenera cada hora;
// las partes con sesión (guardar, RSVP, reseñas, subir foto) son client components que
// cargan su propio estado. Un lugar recién publicado se genera on-demand (dynamicParams).
export const revalidate = 3600

// Pre-renderiza los slugs publicados en build para TTFB instantáneo + buen SEO.
export async function generateStaticParams() {
  try {
    const sb = createAdminClient()
    const { data } = await sb.from('places').select('slug').eq('is_published', true)
    return (data ?? []).map((p) => ({ slug: p.slug as string }))
  } catch {
    // Si la BD no está disponible en build, no fallar: las fichas se generan on-demand.
    return []
  }
}

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

export default async function PlaceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const place = await getPlace(slug) // dedupe con generateMetadata (React cache)

  if (!place) notFound()

  const sb = createAdminClient()
  // events y coords son independientes entre sí → en paralelo (antes secuencial).
  const [{ data: events }, { data: coords }] = await Promise.all([
    sb.from('events')
      .select('id, name, description, image_url, starts_at, ends_at')
      .eq('place_id', place.id)
      .eq('status', 'approved')
      .gte('starts_at', new Date(Date.now() - 86400_000).toISOString())
      .order('starts_at'),
    sb.rpc('places_lnglat', { ids: [place.id] }),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = (events ?? []) as any[]
  // Conteos agregados de asistentes por evento (solo números, sin PII). RPC SECURITY DEFINER;
  // si aún no está aplicado en la BD, degradamos a mapa vacío (no muestra conteos).
  const eventStats: Record<string, { going: number; male: number; female: number }> = await (async () => {
    const ids = upcoming.map((e) => e.id as string)
    if (!ids.length) return {}
    const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
    try {
      const { data } = await rpc('event_gender_stats', { p_event_ids: ids })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Object.fromEntries(((data as any[]) ?? []).map((r) => [r.event_id, r]))
    } catch {
      return {}
    }
  })()
  const ll = coords?.[0]
  // Solo fotos APROBADAS: la consulta va con service role (salta la RLS), así que el filtro
  // tiene que estar aquí. Antes se colaban las pendientes de moderación.
  const photos = ((place.place_photos ?? []) as { id: string; url: string; status: string | null }[])
    .filter((ph) => ph.status === 'approved')
  // La portada que subió el dueño va primero en la galería (sin repetirla si ya es una foto suya).
  const gallery = place.cover_url
    ? [{ id: 'cover', url: place.cover_url }, ...photos.filter((ph) => ph.url !== place.cover_url)]
    : photos
  const tz = (place as unknown as { cities: { timezone: string } | null }).cities?.timezone ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats = (place.place_categories ?? []).map((pc: any) => pc.categories).filter(Boolean)
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
      <DetailTracker placeId={place.id} />
      <AppNav />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <BackButton className="mb-5" />

        {/* Lugar oculto (pausado por su dueño o por el equipo): la ficha avisa en vez de aparentar normalidad. */}
        {place.is_published === false && (
          <p role="status" className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
            Este lugar está cerrado temporalmente o no está disponible por ahora.
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
                <li key={ev.id} className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 shadow-sm">
                  {ev.image_url && (
                    <PhotoImg src={ev.image_url} alt={ev.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" isoClassName="h-7 w-7" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase text-goospe-green">{fmtEventDate(ev.starts_at, tz)}</p>
                    <h3 className="font-medium text-fg">{ev.name}</h3>
                    {ev.description && <p className="line-clamp-1 text-sm text-fg-soft">{ev.description}</p>}
                    {(() => { const s = eventStats[ev.id]; return s ? <AttendanceCounts going={Number(s.going)} male={Number(s.male)} female={Number(s.female)} className="mt-1 text-fg-soft" /> : null })()}
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

      <AppFooter />
    </main>
  )
}
