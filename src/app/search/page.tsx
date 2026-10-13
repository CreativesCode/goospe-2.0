import { Suspense } from 'react'
import { SearchClient } from '@/features/search/search-client'

// El buscador lee su estado de la URL (useSearchParams), que en el App Router exige un límite
// de Suspense. El `metadata` de la ruta está en layout.tsx.
export default function BuscarPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-surface" />}>
      <SearchClient />
    </Suspense>
  )
}
