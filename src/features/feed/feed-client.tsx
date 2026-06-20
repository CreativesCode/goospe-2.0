'use client'

import { RefreshCw } from 'lucide-react'
import { useFeed, type FeedItem } from '@/features/feed/use-feed'
import { useBreakpoint } from '@/features/feed/use-breakpoint'
import { FeedMobile } from '@/features/feed/feed-mobile'
import { FeedTablet } from '@/features/feed/feed-tablet'
import { FeedDesktop } from '@/features/feed/feed-desktop'
import { OutOfCoverageScreen } from '@/features/coverage/components/OutOfCoverageScreen'
import { Loader } from '@/shared/components/loader'
import type { FeedEvent } from '@/features/events/EventFeedCard'

/**
 * Feed de descubrimiento (cliente). Una sola carga de datos (`useFeed`) y tres layouts según
 * el viewport. Recibe `initial`: la primera tanda renderizada en el servidor con la ubicación
 * por defecto (Puerto Varas) → el feed pinta al instante al resolverse el breakpoint, sin
 * esperar geolocalización + 2 RPC; luego refina con la ubicación real en segundo plano.
 */
export function FeedClient({ initial }: { initial: { items: FeedItem[]; events: FeedEvent[] } | null }) {
  const feed = useFeed(initial)
  const bp = useBreakpoint()

  // Gate de cobertura (prioridad máxima): fuera de toda ciudad activa → pantalla "pronto".
  if (feed.coverage === 'uncovered') {
    return <OutOfCoverageScreen coords={feed.coords ?? undefined} />
  }

  if (feed.loading || bp === null) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-surface">
        <Loader size={140} />
      </div>
    )
  }
  if (feed.error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <img src="/brand/isotipo-color.svg" alt="" className="h-12 w-12 opacity-90" />
        <p className="max-w-sm text-fg-soft">No pudimos cargar lugares cerca de ti. Revisa tu conexión e intenta de nuevo.</p>
        <button
          onClick={feed.retryLocation}
          className="inline-flex items-center gap-2 rounded-full bg-goospe-green px-5 py-2.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
        >
          <RefreshCw size={16} strokeWidth={2} /> Reintentar
        </button>
      </div>
    )
  }

  if (bp === 'desktop') return <FeedDesktop feed={feed} />
  if (bp === 'tablet') return <FeedTablet feed={feed} />
  return <FeedMobile feed={feed} />
}
