'use client'

import { useFeed } from '@/features/feed/use-feed'
import { useBreakpoint } from '@/features/feed/use-breakpoint'
import { FeedMobile } from '@/features/feed/feed-mobile'
import { FeedTablet } from '@/features/feed/feed-tablet'
import { FeedDesktop } from '@/features/feed/feed-desktop'
import { Loader } from '@/shared/components/loader'

/**
 * Feed de descubrimiento. Una sola carga de datos (`useFeed`) y tres layouts según
 * el viewport (ver `docs/design`): móvil inmersivo vertical, tablet maestro/detalle,
 * web tablero de descubrimiento.
 */
export default function FeedPage() {
  const feed = useFeed()
  const bp = useBreakpoint()

  if (feed.loading || bp === null) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-surface">
        <Loader size={140} />
      </div>
    )
  }
  if (feed.error) return <div className="p-8 text-red-600">Error: {feed.error}</div>

  if (bp === 'desktop') return <FeedDesktop feed={feed} />
  if (bp === 'tablet') return <FeedTablet feed={feed} />
  return <FeedMobile feed={feed} />
}
