import { Suspense } from 'react'
import { ConciergeClient } from '@/features/concierge/concierge-client'

// El conserje lee `?q=` de la URL (useSearchParams), que en el App Router exige un límite de
// Suspense. El `metadata` de la ruta está en layout.tsx.
export default function ConciergePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-surface" />}>
      <ConciergeClient />
    </Suspense>
  )
}
