import { createAdminClient } from '@/lib/supabase/admin'
import { ListingForm } from '@/features/business/ListingForm'
import { EventManager } from '@/features/business/EventManager'
import { BoostControl } from '@/features/business/BoostControl'
import { ReviewReplies } from '@/features/business/ReviewReplies'
import { MenuUpload } from '@/features/business/MenuUpload'
import { WeeklyReport } from '@/features/business/WeeklyReport'
import { PlaceMedia } from '@/features/business/PlaceMedia'
import { BrandVoiceForm, PlaceIdentity, PlaceStatus, type PlaceVisibility } from '@/features/business/PlaceSettings'
import { OVERVIEW_DAYS, PanelOverview } from '@/features/business/PanelOverview'
import { cardClass } from '@/features/business/ui'
import {
  loadActiveBoost, loadCategories, loadLatestReport, loadOwnerPhotos, loadOwnerReviews, loadPanelEvents, type PanelPlace,
} from '@/features/business/panel-data'
import type { PanelTab } from '@/features/business/panel-tabs'
import { StatsDashboard } from '@/features/analytics/StatsDashboard'
import { BoostPerformance, EventBoostPerformance } from '@/features/analytics/BoostPerformance'
import { loadBoostStats, loadEventBoostStats, loadPlaceSeries } from '@/features/analytics/load'

// Contenido de cada sección del panel. Cada una carga SOLO lo suyo; la página ya validó la
// sesión y la membresía antes de renderizarlas (las lecturas son con service role).
type Admin = ReturnType<typeof createAdminClient>

export type PanelCtx = {
  admin: Admin
  place: PanelPlace
  businessId: string
  role: string
  brandVoice: string | null
  /** Lugares del negocio de este lugar. */
  placesCount: number
  /** Lugares de todos los negocios del usuario. */
  ownedCount: number
  visibility: PlaceVisibility
  pendingReviews: number
  /** "Ahora" del servidor (ms). */
  now: number
}

const tzOf = (place: PanelPlace) => place.cities?.timezone ?? null

async function OverviewSection({ ctx }: { ctx: PanelCtx }) {
  const { admin, place } = ctx
  const [series, reviews, report] = await Promise.all([
    loadPlaceSeries(place.id, OVERVIEW_DAYS, 'day'),
    loadOwnerReviews(admin, place.id),
    loadLatestReport(admin, ctx.businessId, place.id),
  ])
  return <PanelOverview place={place} series={series} reviews={reviews} pendingReviews={ctx.pendingReviews} report={report} now={ctx.now} />
}

// Pin del mapa y solicitudes de cambio pendientes (nombre / ubicación).
async function loadIdentity(admin: Admin, placeId: string) {
  const [{ data: coords }, { data: pending }] = await Promise.all([
    admin.rpc('places_lnglat', { ids: [placeId] }),
    admin.from('place_change_requests').select('kind').eq('place_id', placeId).eq('status', 'pending'),
  ])
  const ll = (coords ?? [])[0] as { lat: number; lng: number } | undefined
  return {
    mapUrl: ll ? `https://www.openstreetmap.org/?mlat=${ll.lat}&mlon=${ll.lng}#map=18/${ll.lat}/${ll.lng}` : null,
    pendingKinds: ((pending ?? []) as { kind: string }[]).map((p) => p.kind),
  }
}

async function ListingSection({ ctx }: { ctx: PanelCtx }) {
  const { admin, place } = ctx
  const [categories, identity] = await Promise.all([loadCategories(admin), loadIdentity(admin, place.id)])
  const addressLine = [place.address?.formatted, place.address?.city].filter(Boolean).join(', ') || null
  return (
    <>
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
      <PlaceIdentity placeId={place.id} name={place.name} addressLine={addressLine} mapUrl={identity.mapUrl} pendingKinds={identity.pendingKinds} />
      <BrandVoiceForm placeId={place.id} brandVoice={ctx.brandVoice} canEdit={ctx.role === 'owner'} placesCount={ctx.placesCount} />
      <PlaceStatus placeId={place.id} visibility={ctx.visibility} />
    </>
  )
}

async function PhotosSection({ ctx: { admin, place } }: { ctx: PanelCtx }) {
  const photos = await loadOwnerPhotos(admin, place.id)
  return <PlaceMedia placeId={place.id} name={place.name} coverUrl={place.cover_url} logoUrl={place.logo_url} photos={photos} />
}

async function EventsSection({ ctx, startNew }: { ctx: PanelCtx; startNew: boolean }) {
  const { admin, place, now } = ctx
  const tz = tzOf(place)
  const [events, boostStats] = await Promise.all([loadPanelEvents(admin, place.id), loadEventBoostStats(place.id)])
  return (
    // Las horas de los eventos se escriben y se muestran en la zona de la ciudad del lugar.
    // La `key` remonta el gestor al llegar con "Nuevo evento" desde la propia sección.
    <EventManager key={startNew ? 'new' : 'list'} placeId={place.id} events={events} timeZone={tz} cityName={place.cities?.name ?? null} now={now} startNew={startNew}>
      <EventBoostPerformance boosts={boostStats} timeZone={tz} now={now} />
    </EventManager>
  )
}

async function ReviewsSection({ ctx: { admin, place } }: { ctx: PanelCtx }) {
  const reviews = await loadOwnerReviews(admin, place.id)
  return <ReviewReplies placeId={place.id} reviews={reviews} timeZone={tzOf(place)} />
}

async function StatsSection({ ctx }: { ctx: PanelCtx }) {
  const { admin, place } = ctx
  const [series, { data }, report] = await Promise.all([
    loadPlaceSeries(place.id, 30, 'day'),
    admin.from('place_stats').select('saves_count, rating, reviews_count').eq('place_id', place.id).maybeSingle(),
    loadLatestReport(admin, ctx.businessId, place.id),
  ])
  const stats = (data ?? {}) as { saves_count?: number | null; rating?: number | null; reviews_count?: number | null }
  return (
    <>
      <StatsDashboard
        placeId={place.id} timeZone={tzOf(place)} cityName={place.cities?.name ?? null}
        initialRows={series.rows} initialOk={series.ok}
        savesTotal={stats.saves_count ?? 0} rating={stats.rating ?? 0} reviewsCount={stats.reviews_count ?? 0}
      />
      <WeeklyReport placeId={place.id} latest={report} />
    </>
  )
}

async function BoostSection({ ctx: { admin, place, now } }: { ctx: PanelCtx }) {
  const tz = tzOf(place)
  const [active, boostStats] = await Promise.all([loadActiveBoost(admin, place.id, now), loadBoostStats(place.id)])
  return (
    <BoostControl placeId={place.id} active={active} timeZone={tz}>
      <BoostPerformance boosts={boostStats} timeZone={tz} now={now} />
    </BoostControl>
  )
}

/** Contenido de la sección activa del panel. */
export function PanelSection({ tab, ctx, startNewEvent }: { tab: PanelTab; ctx: PanelCtx; startNewEvent: boolean }) {
  switch (tab) {
    case 'ficha': return <ListingSection ctx={ctx} />
    case 'fotos': return <PhotosSection ctx={ctx} />
    case 'carta': return <MenuUpload placeId={ctx.place.id} hasMenu={!!ctx.place.menu} />
    case 'eventos': return <EventsSection ctx={ctx} startNew={startNewEvent} />
    case 'resenas': return <ReviewsSection ctx={ctx} />
    case 'estadisticas': return <StatsSection ctx={ctx} />
    case 'destacar': return <BoostSection ctx={ctx} />
    default: return <OverviewSection ctx={ctx} />
  }
}
