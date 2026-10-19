import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PanelEvent } from '@/features/business/EventManager'
import type { OwnerReview } from '@/features/business/ReviewReplies'
import type { OwnerPhoto } from '@/features/business/PlaceMedia'
import type { CategoryOption } from '@/features/business/ListingForm'
import type { MyClaim, MyChangeRequest, MyProposal } from '@/features/business/MyRequests'

// Lecturas del panel del dueño con service role. SOLO llamar después de validar la sesión y,
// para lo que es de un lugar, la membresía (la página lo hace antes de cargar nada).
type Admin = ReturnType<typeof createAdminClient>

export type PanelPlace = {
  id: string
  slug: string
  name: string
  business_id: string | null
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  email: string | null
  price_level: number | null
  tags: string[] | null
  address: { street?: string | null; number?: string | null; city?: string | null; formatted?: string | null } | null
  hours: { osm_raw?: string | null } | null
  menu: unknown | null
  cover_url: string | null
  logo_url: string | null
  is_published: boolean | null
  owner_paused_at: string | null
  cities: { name: string; timezone: string } | null
  place_categories: { category_id: number }[] | null
}

const PLACE_COLS =
  'id, slug, name, business_id, description, vibe_line, phone, whatsapp, website, instagram, email, price_level, tags, address, hours, menu, cover_url, logo_url, is_published, owner_paused_at, cities(name, timezone), place_categories(category_id)'

export async function loadPanelPlace(admin: Admin, placeId: string): Promise<PanelPlace | null> {
  const { data, error } = await admin.from('places').select(PLACE_COLS).eq('id', placeId).maybeSingle()
  if (error) console.error('[loadPanelPlace]', error.message)
  return data as unknown as PanelPlace | null
}

export async function loadCategories(admin: Admin): Promise<CategoryOption[]> {
  const { data } = await admin.from('categories').select('id, name, emoji').eq('enabled', true).order('sort')
  return (data ?? []) as CategoryOption[]
}

/** Fotos propias del negocio (origen 'owner'), las más nuevas primero. */
export async function loadOwnerPhotos(admin: Admin, placeId: string): Promise<OwnerPhoto[]> {
  const { data } = await admin.from('place_photos').select('id, url')
    .eq('place_id', placeId).eq('source', 'owner').order('created_at', { ascending: false })
  return (data ?? []) as OwnerPhoto[]
}

type RsvpRow = { event_id: string; user_id: string; status: string; created_at: string | null }

async function displayNames(admin: Admin, userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)]
  if (!ids.length) return {}
  const { data } = await admin.from('profiles').select('id, display_name').in('id', ids)
  return Object.fromEntries(((data ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name || 'Usuario']))
}

/** Eventos del lugar con sus participaciones. La RLS "own rsvps" no deja al dueño leerlas con su cliente. */
export async function loadPanelEvents(admin: Admin, placeId: string): Promise<PanelEvent[]> {
  const { data: evRows } = await admin.from('events')
    .select('id, name, starts_at, ends_at, description, image_url, is_boosted, status')
    .eq('place_id', placeId).order('starts_at', { ascending: false })
  const events = (evRows ?? []) as Omit<PanelEvent, 'goingCount' | 'interestedCount' | 'attendees'>[]
  if (!events.length) return []

  const { data: rsvpRows } = await admin.from('event_rsvps')
    .select('event_id, user_id, status, created_at').in('event_id', events.map((e) => e.id))
  const rsvps = (rsvpRows ?? []) as RsvpRow[]
  const names = await displayNames(admin, rsvps.map((r) => r.user_id))

  return events.map((e) => {
    const own = rsvps.filter((r) => r.event_id === e.id)
    return {
      ...e,
      goingCount: own.filter((r) => r.status === 'going').length,
      interestedCount: own.filter((r) => r.status === 'interested').length,
      attendees: own
        .map((r) => ({ name: names[r.user_id] ?? 'Usuario', status: r.status, when: r.created_at ?? '' }))
        .sort((a, b) => (a.when < b.when ? 1 : -1)),
    }
  })
}

type ReviewRow = Omit<OwnerReview, 'author'> & { user_id: string }

/** Últimas reseñas visibles con la respuesta del negocio y el nombre del autor. */
export async function loadOwnerReviews(admin: Admin, placeId: string): Promise<OwnerReview[]> {
  const { data, error } = await admin.from('reviews')
    .select('id, user_id, rating, body, created_at, owner_reply, owner_replied_at')
    .eq('place_id', placeId).eq('status', 'approved')
    .order('created_at', { ascending: false }).limit(30)
  if (error) console.error('[loadOwnerReviews]', error.message)
  const rows = (data ?? []) as unknown as ReviewRow[]
  const names = await displayNames(admin, rows.map((r) => r.user_id))
  return rows.map(({ user_id, ...r }) => ({ ...r, created_at: r.created_at ?? '', author: names[user_id] ?? 'Usuario' }))
}

/** Reseñas visibles que el negocio aún no responde (badge de "Reseñas" en el panel). */
export async function countPendingReviews(admin: Admin, placeId: string): Promise<number> {
  const { count, error } = await admin.from('reviews').select('id', { count: 'exact', head: true })
    .eq('place_id', placeId).eq('status', 'approved').is('owner_reply', null)
  if (error) console.error('[countPendingReviews]', error.message)
  return count ?? 0
}

/** Boost activo del lugar (no de un evento), si lo hay. */
export async function loadActiveBoost(admin: Admin, placeId: string, now: number): Promise<{ id: string; ends_at: string } | null> {
  const { data } = await admin.from('boosts').select('id, ends_at')
    .eq('place_id', placeId).is('event_id', null).eq('status', 'active')
    .order('ends_at', { ascending: false }).limit(1)
  const row = (data ?? [])[0] as { id: string; ends_at: string } | undefined
  return row && new Date(row.ends_at).getTime() > now ? row : null
}

/** Último informe semanal de ESTE lugar (filtrado por place_id dentro del content). */
export async function loadLatestReport(admin: Admin, businessId: string, placeId: string) {
  const { data } = await admin.from('business_reports').select('content, created_at')
    .eq('business_id', businessId).eq('kind', 'weekly').order('created_at', { ascending: false }).limit(10)
  const rows = (data ?? []) as { content: { place_id?: string; summary?: string } | null; created_at: string | null }[]
  // El más reciente CON resumen: los programados sin IA (solo números) no tapan al anterior.
  const row = rows.find((r) => r.content?.place_id === placeId && r.content?.summary)
  return row?.content?.summary ? { summary: row.content.summary, created_at: row.created_at ?? '' } : null
}

type ClaimRow = { id: string; status: string | null; reject_reason: string | null; created_at: string | null; places: { name: string } | null }
type RequestRow = {
  id: string; place_id: string; kind: string; status: string; reject_reason: string | null; created_at: string
  payload: { name?: string; reference?: string | null } | null; places: { name: string } | null
}

type ProposalRow = { id: string; name: string; address: string | null; city_name: string | null; status: string; reject_reason: string | null; created_at: string }

/** "Mis solicitudes": reclamos, solicitudes de cambio y lugares propuestos del usuario, pendientes o rechazados. */
export async function loadMyRequests(admin: Admin, userId: string): Promise<{ claims: MyClaim[]; changes: MyChangeRequest[]; proposals: MyProposal[] }> {
  const [claimsRes, changesRes, proposalsRes] = await Promise.all([
    admin.from('claims').select('id, status, reject_reason, created_at, places(name)')
      .eq('user_id', userId).in('status', ['pending', 'rejected']).order('created_at', { ascending: false }).limit(10),
    admin.from('place_change_requests').select('id, place_id, kind, status, reject_reason, created_at, payload, places(name)')
      .eq('user_id', userId).in('status', ['pending', 'rejected']).order('created_at', { ascending: false }).limit(10),
    admin.from('place_proposals').select('id, name, address, city_name, status, reject_reason, created_at')
      .eq('user_id', userId).in('status', ['pending', 'rejected']).order('created_at', { ascending: false }).limit(10),
  ])
  if (claimsRes.error) console.error('[loadMyRequests] claims:', claimsRes.error.message)
  if (changesRes.error) console.error('[loadMyRequests] cambios:', changesRes.error.message)
  // Sin la migración 0039 la tabla no existe: se registra y el resto de las solicitudes se muestra igual.
  if (proposalsRes.error) console.error('[loadMyRequests] propuestas:', proposalsRes.error.message)

  const claims = ((claimsRes.data ?? []) as unknown as ClaimRow[]).map((c) => ({
    id: c.id, placeName: c.places?.name ?? 'Lugar', status: c.status ?? 'pending',
    rejectReason: c.reject_reason, createdAt: c.created_at ?? '',
  }))
  const changes = ((changesRes.data ?? []) as unknown as RequestRow[]).map((r) => ({
    id: r.id, placeId: r.place_id, placeName: r.places?.name ?? 'Lugar', kind: r.kind, status: r.status,
    detail: r.kind === 'name' ? r.payload?.name ?? '' : r.payload?.reference ?? '',
    rejectReason: r.reject_reason, createdAt: r.created_at,
  }))
  const proposals = ((proposalsRes.data ?? []) as ProposalRow[]).map((p) => ({
    id: p.id, name: p.name, detail: [p.address, p.city_name].filter(Boolean).join(', '), status: p.status,
    rejectReason: p.reject_reason, createdAt: p.created_at,
  }))
  return { claims, changes, proposals }
}
