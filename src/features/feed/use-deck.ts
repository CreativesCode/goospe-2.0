'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/**
 * Mazo del feed: contenedor con scroll vertical y snap donde cada tarjeta ocupa el alto
 * completo. El índice activo se deriva del scroll (`scrollTop / clientHeight`), así que rueda,
 * gesto, botones y teclado comparten una sola fuente de verdad. Las flechas ↑/↓ del teclado
 * avanzan salvo que se esté escribiendo o haya un diálogo abierto.
 */
export function useDeck() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el || !el.clientHeight) return
    const next = Math.round(el.scrollTop / el.clientHeight)
    if (next !== activeRef.current) {
      activeRef.current = next
      setActive(next)
    }
  }, [])

  const jumpTo = useCallback((index: number, instant = false) => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: Math.max(0, index) * el.clientHeight, behavior: instant || reduce ? 'instant' : 'smooth' })
  }, [])

  const step = useCallback((delta: number) => jumpTo(activeRef.current + delta), [jumpTo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      e.preventDefault()
      step(e.key === 'ArrowDown' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  return { ref, active, onScroll, jumpTo, step }
}
