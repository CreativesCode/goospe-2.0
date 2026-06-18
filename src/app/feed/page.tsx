import { createAdminClient } from '@/lib/supabase/admin'
import { FeedClient } from '@/features/feed/feed-client'
import type { FeedItem } from '@/features/feed/use-feed'
import type { FeedEvent } from '@/features/events/EventFeedCard'

// Semilla SSR de la primera tanda con la ubicación del piloto (Puerto Varas). Es anónima (sin
// auth → sin personalización por gusto) e igual para todos → cacheable por ISR. El cliente la
// pinta al instante y refina con la ubicación real del usuario al montar (ver FeedClient/useFeed).
const SEED = { lat: -41.3195, lng: -72.9854 }
export const revalidate = 300

export default async function FeedPage() {
  const admin = createAdminClient()
  // `as never` en los args: workaround del tipado de rpc de supabase-js para funciones tabla.
  const [places, evs] = await Promise.all([
    admin.rpc('get_feed', { p_lat: SEED.lat, p_lng: SEED.lng, p_radius_m: 25000, p_limit: 40, p_offset: 0 } as never),
    admin.rpc('get_feed_events', { p_lat: SEED.lat, p_lng: SEED.lng, p_radius_m: 25000, p_limit: 8 } as never),
  ])
  const items = (places.data ?? []) as FeedItem[]
  const events = (evs.data ?? []) as FeedEvent[]
  // Solo sembramos si hubo datos; si no, el cliente arranca con su loader habitual.
  const initial = items.length ? { items, events } : null

  return <FeedClient initial={initial} />
}
