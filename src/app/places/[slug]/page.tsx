import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { deletePhoto } from './actions'
import { PlaceReviews } from '@/features/reviews/PlaceReviews'
import { PhotoUpload } from '@/features/photos/PhotoUpload'
import { RsvpButton } from '@/features/events/RsvpButton'

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
      <dt className="w-32 shrink-0 text-goospe-gray/50">{label}</dt>
      <dd className="text-goospe-gray break-words">{children}</dd>
    </div>
  )
}

export default async function PlaceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = createAdminClient()

  const { data: place } = await sb
    .from('places')
    .select(
      'id, slug, name, address, phone, whatsapp, website, instagram, email, hours, price_level, description, vibe_line, tags, ai_enriched_at, embedding_model, source, claimed, business_id, is_published, cover_url, logo_url, created_at, updated_at, place_photos(id, url, status, source, storage_path), place_categories(categories(emoji, name, slug))'
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

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/places" className="flex items-center gap-2 text-sm text-goospe-gray/70 hover:text-goospe-green">
            ← Volver
          </Link>
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-6" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* título */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-goospe-gray/60">
              {cats.map((c) => (
                <span key={c.slug}>{c.emoji} {c.name}</span>
              ))}
            </div>
            <h1 className="text-3xl font-medium text-goospe-gray">{place.name}</h1>
            {place.vibe_line && <p className="mt-1 text-lg font-medium text-goospe-green">{place.vibe_line}</p>}
          </div>
          {place.price_level && (
            <span className="text-lg font-medium">
              <span className="text-goospe-gray">{'$'.repeat(place.price_level)}</span>
              <span className="text-goospe-gray/25">{'$'.repeat(4 - place.price_level)}</span>
            </span>
          )}
        </div>

        {/* fotos */}
        <section className="mb-8">
          {photos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((ph, i) => (
                <div key={ph.id ?? i} className="group relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt={place.name} className="aspect-[4/3] w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                    {ph.source ?? '?'} · {ph.status}
                  </span>
                  <form action={deletePhoto}>
                    <input type="hidden" name="id" value={ph.id} />
                    <input type="hidden" name="path" value={ph.storage_path ?? ''} />
                    <input type="hidden" name="slug" value={place.slug} />
                    <button
                      type="submit"
                      title="Eliminar foto"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
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
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-goospe-gray/40">Resumen (IA)</h2>
            <p className="text-goospe-gray/80">{place.description ?? '—'}</p>
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
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-goospe-gray/40">Datos</h2>
            <dl className="divide-y divide-black/5">
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

        {/* meta técnica */}
        <section className="mt-8 rounded-xl bg-black/[0.02] p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-goospe-gray/40">Meta</h2>
          <dl className="grid gap-x-6 sm:grid-cols-2">
            <Field label="Slug">{place.slug}</Field>
            <Field label="Fuente">{place.source}</Field>
            <Field label="Coordenadas">{ll ? `${ll.lat?.toFixed(5)}, ${ll.lng?.toFixed(5)}` : null}</Field>
            <Field label="Embedding">{place.embedding_model ?? 'sin generar'}</Field>
            <Field label="Enriquecido">{place.ai_enriched_at ? new Date(place.ai_enriched_at).toLocaleString('es-CL') : 'no'}</Field>
            <Field label="Reclamado">{place.claimed ? 'sí' : 'no'}</Field>
            <Field label="Publicado">{place.is_published ? 'sí' : 'no'}</Field>
            <Field label="Creado">{new Date(place.created_at!).toLocaleString('es-CL')}</Field>
          </dl>
        </section>

        {/* eventos */}
        {upcoming.length > 0 && (
          <section className="mt-10 border-t border-black/5 pt-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-goospe-gray/40">Próximos eventos</h2>
            <ul className="space-y-3">
              {upcoming.map((ev) => (
                <li key={ev.id} className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                  {ev.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.image_url} alt={ev.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase text-goospe-green">{fmtEventDate(ev.starts_at)}</p>
                    <h3 className="font-medium text-goospe-gray">{ev.name}</h3>
                    {ev.description && <p className="line-clamp-1 text-sm text-goospe-gray/60">{ev.description}</p>}
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
    </main>
  )
}
