import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowRight, EyeOff } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { ListingForm } from '@/features/business/ListingForm'
import { EventManager } from '@/features/business/EventManager'
import { BoostControl } from '@/features/business/BoostControl'
import { ReviewReplies } from '@/features/business/ReviewReplies'
import { MenuUpload } from '@/features/business/MenuUpload'
import { WeeklyReport } from '@/features/business/WeeklyReport'
import { PlaceMedia } from '@/features/business/PlaceMedia'
import { BrandVoiceForm, PlaceIdentity, PlaceStatus, type PlaceVisibility } from '@/features/business/PlaceSettings'
import { cardClass } from '@/features/business/ui'
import {
  loadActiveBoost, loadCategories, loadLatestReport, loadOwnerPhotos, loadOwnerReviews, loadPanelEvents, loadPanelPlace,
} from '@/features/business/panel-data'
import { StatsDashboard } from '@/features/analytics/StatsDashboard'
import { BoostPerformance, EventBoostPerformance } from '@/features/analytics/BoostPerformance'
import { loadBoostStats, loadEventBoostStats, loadPlaceSeries } from '@/features/analytics/load'

export const dynamic = 'force-dynamic'

type Admin = ReturnType<typeof createAdminClient>
type Sibling = { id: string; name: string; is_published: boolean | null }

const SECTIONS = [
  ['#estadisticas', 'Estadísticas'], ['#ficha', 'Ficha'], ['#fotos', 'Imágenes'],
  ['#eventos', 'Eventos'], ['#resenas', 'Reseñas'], ['#negocio', 'Negocio'],
] as const

const pill = (on: boolean) =>
  `mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${on ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-line text-muted'}`

// Datos del negocio para el panel: rol del usuario, tono de marca y sus otros lugares.
async function loadBusiness(admin: Admin, businessId: string, userId: string) {
  const [{ data: member }, { data: biz }, { data: sib }] = await Promise.all([
    admin.from('business_members').select('role').eq('business_id', businessId).eq('user_id', userId).maybeSingle(),
    admin.from('businesses').select('brand_voice').eq('id', businessId).maybeSingle(),
    admin.from('places').select('id, name, is_published').eq('business_id', businessId).order('name'),
  ])
  return {
    // null = no es miembro; un miembro sin rol explícito cuenta como 'member'.
    role: member ? ((member as { role: string | null }).role ?? 'member') : null,
    brandVoice: (biz as { brand_voice: string | null } | null)?.brand_voice ?? null,
    siblings: (sib ?? []) as Sibling[],
  }
}

async function loadExtras(admin: Admin, placeId: string) {
  const [{ data: stats }, { data: coords }, { data: pending }] = await Promise.all([
    admin.from('place_stats').select('saves_count, rating, reviews_count').eq('place_id', placeId).maybeSingle(),
    admin.rpc('places_lnglat', { ids: [placeId] }),
    admin.from('place_change_requests').select('kind').eq('place_id', placeId).eq('status', 'pending'),
  ])
  const ll = (coords ?? [])[0] as { lat: number; lng: number } | undefined
  return {
    stats: (stats ?? {}) as { saves_count?: number | null; rating?: number | null; reviews_count?: number | null },
    mapUrl: ll ? `https://www.openstreetmap.org/?mlat=${ll.lat}&mlon=${ll.lng}#map=18/${ll.lat}/${ll.lng}` : null,
    pendingKinds: ((pending ?? []) as { kind: string }[]).map((p) => p.kind),
  }
}

export default async function EditListingPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params
  if (!isUuid(placeId)) notFound()
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/panel/${placeId}`)

  const admin = createAdminClient()
  const place = await loadPanelPlace(admin, placeId)
  if (!place) notFound()
  // Verificar membresía ANTES de cargar nada más: el usuario debe pertenecer al negocio dueño.
  if (!place.business_id) redirect('/panel')
  const business = await loadBusiness(admin, place.business_id, user.id)
  if (!business.role) redirect('/panel')

  const now = Date.now()
  const tz = place.cities?.timezone ?? null
  const [events, activeBoost, reviews, latestReport, series, boostStats, eventBoostStats, categories, photos, extras] = await Promise.all([
    loadPanelEvents(admin, placeId),
    loadActiveBoost(admin, placeId, now),
    loadOwnerReviews(admin, placeId),
    loadLatestReport(admin, place.business_id, placeId),
    loadPlaceSeries(placeId, 30, 'day'),
    loadBoostStats(placeId),
    loadEventBoostStats(placeId),
    loadCategories(admin),
    loadOwnerPhotos(admin, placeId),
    loadExtras(admin, placeId),
  ])

  const visibility: PlaceVisibility = place.is_published ? 'visible' : place.owner_paused_at ? 'paused' : 'hidden_by_admin'
  const addressLine = [place.address?.formatted, place.address?.city].filter(Boolean).join(', ') || null
  const { siblings } = business

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-6 sm:px-5 sm:py-8">
        {/* maestro: lista de lugares (solo tablet/web) */}
        {siblings.length > 1 && (
          <aside className="hidden w-64 shrink-0 lg:block">
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">Mis lugares</h2>
            <nav className="flex flex-col gap-2">
              {siblings.map((s) => (
                <Link key={s.id} href={`/panel/${s.id}`} aria-current={s.id === place.id ? 'page' : undefined}
                  className={`rounded-2xl border bg-card px-4 py-3 transition ${s.id === place.id ? 'border-goospe-green ring-1 ring-goospe-green' : 'border-line hover:border-goospe-green/40'}`}>
                  <div className="truncate text-sm font-medium text-fg">{s.name}</div>
                  <span className={pill(!!s.is_published)}>{s.is_published ? 'Publicado' : 'Oculto'}</span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        {/* detalle */}
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <Link href="/panel" className="text-xs text-fg-soft hover:text-goospe-green lg:hidden">← Mis lugares</Link>
              <h1 className="text-2xl font-medium text-fg [overflow-wrap:anywhere]">{place.name}</h1>
              <p className="text-sm text-muted">Administra cómo se ve tu lugar en Goospe</p>
            </div>
            {/* Oculto: la ficha pública responde 404; el dueño la ve en la vista previa. */}
            <Link href={visibility === 'visible' ? `/places/${place.slug}` : `/places/${place.slug}/preview`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-goospe-green/40 px-4 py-2 text-sm font-medium text-goospe-green-dark hover:bg-goospe-green/10">
              {visibility === 'visible' ? 'Ver ficha pública' : 'Vista previa'} <ArrowRight size={14} strokeWidth={1.75} />
            </Link>
          </div>

          {visibility !== 'visible' && (
            <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
              <EyeOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
              {visibility === 'paused' ? 'Tu lugar está cerrado temporalmente: no aparece en Goospe. Reactívalo en “Visibilidad”.' : 'Este lugar está oculto por el equipo de Goospe.'}
            </p>
          )}

          {/* Atajos a las secciones: el panel es largo, sobre todo en móvil. */}
          <nav aria-label="Secciones del panel" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {SECTIONS.map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg">{label}</a>
            ))}
          </nav>

          <div className="space-y-6">
            <StatsDashboard
              placeId={place.id} timeZone={tz} cityName={place.cities?.name ?? null}
              initialRows={series.rows} initialOk={series.ok}
              savesTotal={extras.stats.saves_count ?? 0} rating={extras.stats.rating ?? 0} reviewsCount={extras.stats.reviews_count ?? 0}
            />

            <WeeklyReport placeId={place.id} latest={latestReport} />

            <BoostControl placeId={place.id} active={activeBoost} timeZone={tz}>
              <BoostPerformance boosts={boostStats} timeZone={tz} now={now} />
            </BoostControl>

            <section id="ficha" className={`scroll-mt-32 ${cardClass}`}>
              <h2 className="mb-4 font-medium text-fg">Ficha</h2>
              <ListingForm
                categories={categories}
                place={{
                  id: place.id, description: place.description, vibe_line: place.vibe_line, phone: place.phone,
                  whatsapp: place.whatsapp, website: place.website, instagram: place.instagram, email: place.email,
                  price_level: place.price_level, tags: place.tags, address: place.address,
                  hoursRaw: place.hours?.osm_raw ?? null,
                  categoryIds: (place.place_categories ?? []).map((c) => c.category_id),
                }}
              />
            </section>

            <PlaceIdentity placeId={place.id} name={place.name} addressLine={addressLine} mapUrl={extras.mapUrl} pendingKinds={extras.pendingKinds} />

            <PlaceMedia placeId={place.id} name={place.name} coverUrl={place.cover_url} logoUrl={place.logo_url} photos={photos} />

            <MenuUpload placeId={place.id} hasMenu={!!place.menu} />

            {/* Las horas de los eventos se escriben y se muestran en la zona de la ciudad del lugar. */}
            <EventManager placeId={place.id} events={events} timeZone={tz} cityName={place.cities?.name ?? null} now={now}>
              <EventBoostPerformance boosts={eventBoostStats} timeZone={tz} now={now} />
            </EventManager>

            <ReviewReplies placeId={place.id} reviews={reviews} timeZone={tz} />

            <BrandVoiceForm placeId={place.id} brandVoice={business.brandVoice} canEdit={business.role === 'owner'} placesCount={siblings.length} />

            <PlaceStatus placeId={place.id} visibility={visibility} />
          </div>
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
