'use client'

import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

/**
 * Breakpoint activo según el ancho de viewport. Devuelve `null` hasta montar
 * (evita flash de SSR; el feed muestra su pantalla de carga mientras tanto).
 * - mobile  : < 768px  → feed inmersivo vertical
 * - tablet  : 768–1279 → maestro / detalle
 * - desktop : ≥ 1280   → tablero de descubrimiento (bento)
 */
export function useBreakpoint(): Breakpoint | null {
  const [bp, setBp] = useState<Breakpoint | null>(null)

  useEffect(() => {
    const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1279px)')
    const desktop = window.matchMedia('(min-width: 1280px)')
    const compute = () => setBp(desktop.matches ? 'desktop' : tablet.matches ? 'tablet' : 'mobile')
    compute()
    tablet.addEventListener('change', compute)
    desktop.addEventListener('change', compute)
    return () => {
      tablet.removeEventListener('change', compute)
      desktop.removeEventListener('change', compute)
    }
  }, [])

  return bp
}
