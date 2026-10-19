'use client'

import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'wide'

/**
 * Layout del feed según el ancho de viewport. Devuelve `null` hasta montar (evita flash de
 * SSR; el feed muestra su pantalla de carga mientras tanto).
 * - mobile : < 720px → mazo inmersivo a pantalla completa
 * - wide   : ≥ 720px → mazo + panel lateral (tablet lo apila en una columna con CSS)
 * Es la única vista que elige layout con JS: los dos mazos son árboles distintos; el resto de
 * la app usa breakpoints de Tailwind (`md` = 720, `lg` = 1100).
 */
export function useBreakpoint(): Breakpoint | null {
  const [bp, setBp] = useState<Breakpoint | null>(null)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 720px)')
    const compute = () => setBp(wide.matches ? 'wide' : 'mobile')
    compute()
    wide.addEventListener('change', compute)
    return () => wide.removeEventListener('change', compute)
  }, [])

  return bp
}
