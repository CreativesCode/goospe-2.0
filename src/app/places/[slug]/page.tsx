import { RsvpButton } from '@/features/events/RsvpButton'
import { PhotoGallery } from '@/features/photos/PhotoGallery'
import { PhotoUpload } from '@/features/photos/PhotoUpload'
import { DetailTracker } from '@/features/places/DetailTracker'
import { DirectionsLink } from '@/features/places/DirectionsLink'
import { PlaceActions } from '@/features/places/PlaceActions'
import { PlaceReviews } from '@/features/reviews/PlaceReviews'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppFooter } from '@/shared/components/app-footer'
import { AppNav } from '@/shared/components/app-nav'
import { BackButton } from '@/shared/components/back-button'
import { categoryIcon } from '@/shared/lib/icons'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const sb = createAdminClient()
  const { data } = await sb
    .from('places')
    .select('name, vibe_line, description, place_photos(url, status)')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return { title: 'Lugar — Goospe' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photo: string | undefined = ((data as any).place_photos ?? []).find((p: any) => p.status === 'approved')?.url
  const title = `${data.name} — Puerto Varas | Goospe`
  const description = data.vibe_line || data.description || `Descubre ${data.name} en Puerto Varas con Goospe.`
  // Foto de la ficha como imagen de compartir. El proxy /api/place-photo sirve a 800px por
  // defecto; pedimos 1200px para una tarjeta OG nítida. Si no hay foto aprobada, omitimos
  // `images` y Next usa la imagen de marca por defecto (src/app/opengraph-image.tsx).
  const ogPhoto = photo?.startsWith('/api/place-photo') ? `${photo}&w=1200` : photo
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

const fmtEventDate = (s: string) =>
  new Date(s).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const dynamic = 'force-dynamic'

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
      <dd className="break-words text-fg">{children}</dd>
    </div>
  )
}

export default async function PlaceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = createAdminClient()

  const { data: place } = await sb
    .from('places')
    .select(
      'id, slug, name, address, phone, whatsapp, website, instagram, email, hours, price_level, description, vibe_line, tags, menu, ai_enriched_at, embedding_model, source, claimed, business_id, is_published, cover_url, logo_url, created_at, updated_at, place_photos(id, url, status, source, storage_path), place_categories(categories(emoji, name, slug))'
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!place) notFound()

  const { data: events } = await sb
    .from('events')
    .select('id, name, description, image_url, starts_at, ends_at')
    .eq('place_id', place.id)
    .eq('status', 'approved')
    .gte('starts_at', new Date(Date.now() - 86400_000).toISOString())
    .order('starts_at')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = (events ?? []) as any[]

  const { data: coords } = await sb.rpc('places_lnglat', { ids: [place.id] })
  const ll = coords?.[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = (place.place_photos ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats = (place.place_categories ?? []).map((pc: any) => pc.categories).filter(Boolean)
  const addr = place.address as { street?: string; number?: string; city?: string; formatted?: string } | null
  const hours = place.hours as { osm_raw?: string } | null
  const menu = place.menu as { sections?: { name: string; items: { name: string; price: string | null; description: string | null }[] }[] } | null

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <DetailTracker placeId={place.id} />
      <AppNav />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <BackButton className="mb-5" />

        {/* título */}
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-3 text-sm text-fg-soft">
            {cats.map((c) => {
              const Cat = categoryIcon(c.emoji)
              return <span key={c.slug} className="inline-flex items-center gap-1"><Cat size={14} strokeWidth={1.75} /> {c.name}</span>
            })}
          </div>
          <h1 className="text-3xl font-medium text-fg">{place.name}</h1>
          {place.vibe_line && <p className="mt-1 text-lg font-medium text-goospe-green">{place.vibe_line}</p>}
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

        {/* fotos */}
        <section className="mb-8">
          {photos.length ? (
            <PhotoGallery photos={photos} alt={place.name} />
          ) : (
            <div className="flex aspect-[16/6] items-center justify-center rounded-2xl bg-goospe-gradient">
              <img src="/brand/isotipo-white.svg" alt="" className="h-14 w-14 opacity-90" />
            </div>
          )}
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
              <Field label="Teléfono">{place.phone}</Field>
              <Field label="WhatsApp">{place.whatsapp}</Field>
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
              <Field label="Email">{place.email}</Field>
              <Field label="Horario (OSM)">{hours?.osm_raw}</Field>
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.image_url} alt={ev.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase text-goospe-green">{fmtEventDate(ev.starts_at)}</p>
                    <h3 className="font-medium text-fg">{ev.name}</h3>
                    {ev.description && <p className="line-clamp-1 text-sm text-fg-soft">{ev.description}</p>}
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
