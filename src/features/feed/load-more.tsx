'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Centinela de scroll infinito, común a los tres layouts del feed. Cuando entra en el viewport
 * (o en el contenedor con scroll que se pase en `root`) pide la siguiente página.
 *  - `watch` cambia cuando crece la lista: re-observa, así se sigue cargando si la página
 *    nueva no alcanzó a sacar el centinela de pantalla.
 *  - `auto={false}`: botón manual (p. ej. con un filtro activo, para no recorrer la ciudad
 *    entera a base de peticiones automáticas).
 */
export function LoadMore({
  hasMore,
  loading,
  onLoadMore,
  watch,
  root,
  rootMargin = '600px 0px',
  auto = true,
  className = '',
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  watch: number
  root?: RefObject<HTMLElement | null>
  rootMargin?: string
  auto?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || !auto) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore() },
      { root: root?.current ?? null, rootMargin }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, auto, onLoadMore, root, rootMargin, watch])

  if (!hasMore) return null
  return (
    <div ref={ref} className={`flex items-center justify-center py-6 text-sm text-muted ${className}`}>
      {auto || loading ? (
        <span className="inline-flex items-center gap-2" role="status">
          <Loader2 size={16} className="animate-spin" /> Cargando más lugares…
        </span>
      ) : (
        <button
          onClick={onLoadMore}
          className="rounded-full border border-line bg-card px-5 py-2 text-sm font-medium text-fg-soft transition hover:text-fg"
        >
          Cargar más lugares
        </button>
      )}
    </div>
  )
}
