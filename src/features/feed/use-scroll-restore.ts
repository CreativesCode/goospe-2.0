'use client'

import { useEffect, useRef, type RefObject } from 'react'

// Posición del feed (sessionStorage) para volver al mismo punto tras visitar una ficha.
// Una clave por layout: el mazo móvil y la lista de la tablet guardan el scroll de SU
// contenedor; el tablero web, el de la ventana. La tablet guarda además el lugar seleccionado.
const KEYS = {
  mobile: 'goospe:feed-scroll',
  tablet: 'goospe:feed-scroll:tablet',
  'tablet-hero': 'goospe:feed-scroll:tablet-hero',
  desktop: 'goospe:feed-scroll:desktop',
} as const
export type FeedScrollSlot = keyof typeof KEYS

export function readFeedScroll(slot: FeedScrollSlot): string | null {
  try { return sessionStorage.getItem(KEYS[slot]) } catch { return null }
}

export function writeFeedScroll(slot: FeedScrollSlot, value: string) {
  try { sessionStorage.setItem(KEYS[slot], value) } catch { /* sessionStorage no disponible */ }
}

/** Otra ciudad = otro feed: las posiciones guardadas ya no significan nada. */
export function clearFeedScroll() {
  try {
    for (const key of Object.values(KEYS)) sessionStorage.removeItem(key)
  } catch { /* sessionStorage no disponible */ }
}

/**
 * Restaura el scroll guardado UNA vez, cuando `ready` pasa a true, y desde entonces lo va
 * guardando. `ready` debe significar "la lista definitiva ya está pintada": si se restaurara
 * contra la tanda SSR (40 cards) el navegador recortaría la posición al final de esa tanda
 * (volver desde la card 119 dejaba en la 40).
 *
 * No se guarda nada ANTES de restaurar: al volver atrás el navegador y el router mueven el
 * scroll por su cuenta y pisarían la posición buena con un 0.
 *
 * `target`: contenedor con scroll propio. Sin él se usa la ventana, y entonces `anchor` (un
 * nodo del feed) permite ignorar el scroll-al-inicio que hace el router al SALIR del feed.
 */
export function useScrollRestore(
  slot: FeedScrollSlot,
  ready: boolean,
  { target, anchor }: { target?: RefObject<HTMLElement | null>; anchor?: RefObject<HTMLElement | null> } = {}
) {
  const restored = useRef(false)

  useEffect(() => {
    if (!ready) return
    const el = target ? target.current : null
    if (target && !el) return

    if (!restored.current) {
      restored.current = true
      const y = Number(readFeedScroll(slot) || 0)
      if (y > 0) {
        ;(el ?? window).scrollTo({ top: y, behavior: 'instant' })
      }
    }

    let raf = 0
    const save = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (anchor && !anchor.current?.isConnected) return // el feed ya no está en pantalla
        writeFeedScroll(slot, String(el ? el.scrollTop : window.scrollY))
      })
    }
    const source: HTMLElement | Window = el ?? window
    source.addEventListener('scroll', save, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      source.removeEventListener('scroll', save)
    }
  }, [slot, ready, target, anchor])
}
