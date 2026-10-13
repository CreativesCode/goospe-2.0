import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'

// Lecturas de eventos para la cartelera, la página del evento, su imagen y su .ics.
// Van con service role (saltan la RLS), así que el filtro de "qué es público" vive AQUÍ:
// solo eventos aprobados o cancelados, y solo de lugares publicados.

export type EventStats = { going: number; male: number; female: number; interested: number }

/**
 * Conteos agregados por evento (solo números, sin PII). `going`/`male`/`female` cuentan solo
 * "asistiré"; `interested` va aparte. Si el RPC falla, mapa vacío (no se pintan conteos).
 */
export async function fetchEventStats(ids: string[]): Promise<Record<string, EventStats>> {
  if (!ids.length) return {}
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('event_gender_stats', { p_event_ids: ids })
  if (error) {
    console.error('[events] event_gender_stats:', error.message)
    return {}
  }
  return Object.fromEntries((data ?? []).map((r) => [r.event_id, {
    going: Number(r.going) || 0,
    male: Number(r.male) || 0,
    female: Number(r.female) || 0,
    // Antes de la migración 0041 la columna no existe.
    interested: Number(r.interested) || 0,
  }]))
}

export type EventCity = { id: number; slug: string; name: string; timezone: string }
export type EventPlace = {
  id: string
  slug: string
  name: string
  address: { street?: string; number?: string; city?: string; formatted?: string } | null
  cover_url: string | null
  is_published: boolean | null
  business_status: string | null
  cities: EventCity | null
}
export type PublicEvent = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  starts_at: string
  ends_at: string | null
  status: string | null
  places: EventPlace | null
}

const EVENT_SELECT =
  'id, name, description, image_url, starts_at, ends_at, status, places(id, slug, name, address, cover_url, is_published, business_status, cities(id, slug, name, timezone))'

const isPublicPlace = (p: EventPlace | null): p is EventPlace =>
  !!p && p.is_published === true && p.business_status !== 'CLOSED_PERMANENTLY'

/**
 * Un evento visible para el público: aprobado o cancelado (el cancelado se muestra como tal,
 * no como 404) y de un lugar publicado. Cualquier otro caso → null.
 */
export const getPublicEvent = cache(async (id: string): Promise<(PublicEvent & { places: EventPlace }) | null> => {
  if (!isUuid(id)) return null
  const sb = createAdminClient()
  const { data, error } = await sb.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(`[events] ${error.message}`)
  const ev = data as unknown as PublicEvent | null
  if (!ev || (ev.status !== 'approved' && ev.status !== 'cancelled') || !isPublicPlace(ev.places)) return null
  return { ...ev, places: ev.places }
})

/** Dirección del lugar de un evento, sin el nombre ("Calle 1, Puerto Varas"). */
export function eventAddressText(place: EventPlace): string {
  const a = place.address
  const street = a?.formatted ?? [a?.street, a?.number].filter(Boolean).join(' ')
  const city = a?.city?.trim() || place.cities?.name
  // `formatted` suele traer ya la ciudad: no repetirla.
  return [street, city && !street.includes(city) ? city : null].filter(Boolean).join(', ')
}

/** Nombre del lugar + dirección (para metadatos y el campo "ubicación" del calendario). */
export function eventLocationText(place: EventPlace): string {
  return [place.name, eventAddressText(place)].filter(Boolean).join(', ')
}

const UPCOMING_LIMIT = 200

/**
 * Eventos aprobados que aún pueden estar vigentes (los que empezaron hace menos de un día se
 * incluyen: el filtro fino "ya terminó" y la ventana Hoy/Semana se calculan después, en la
 * zona horaria de cada ciudad).
 */
export async function listUpcomingEvents(now: number): Promise<(PublicEvent & { places: EventPlace })[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'approved')
    .gte('starts_at', new Date(now - 86400_000).toISOString())
    .order('starts_at')
    .order('id')
    .limit(UPCOMING_LIMIT)
  if (error) throw new Error(`[events] ${error.message}`)
  return ((data ?? []) as unknown as PublicEvent[])
    .filter((ev): ev is PublicEvent & { places: EventPlace } => isPublicPlace(ev.places))
}
