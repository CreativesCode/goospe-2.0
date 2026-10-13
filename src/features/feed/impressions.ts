'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { track } from '@/lib/track'

// Impresiones del feed (`view_card`). Una por card y por carga de página, pase lo que pase:
// antes cada layout llevaba su propio registro, así que volver de una ficha, girar la tablet
// (cambio de layout) o recibir otra página volvía a contar las mismas cards.
const seen = new Set<string>()

/** Registra la impresión de una card una sola vez. Devuelve true si se envió. */
export function trackImpression(kind: 'place' | 'event', id: string): boolean {
  const key = `${kind}:${id}`
  if (seen.has(key)) return false
  seen.add(key)
  track('view_card', kind === 'event' ? { eventId: id } : { placeId: id })
  return true
}

const DWELL_MS = 2000
const MIN_RATIO = 0.6

/**
 * Cuenta una impresión cuando una card (`[data-track-id]`, con `data-kind="event"` en eventos)
 * permanece ≥ 60 % visible durante 2 s. El observer se crea una vez; `watch` cambia cuando
 * crece la lista y solo se observan los nodos nuevos (observe() es idempotente). La visibilidad
 * se mide contra el viewport (el mazo móvil ocupa la pantalla entera; la web hace scroll de página).
 */
export function useCardImpressions(containerRef: RefObject<HTMLElement | null>, watch: unknown) {
  const obsRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          const id = el.dataset.trackId
          if (!id) continue
          const kind = el.dataset.kind === 'event' ? 'event' : 'place'
          const key = `${kind}:${id}`
          if (e.isIntersecting && e.intersectionRatio >= MIN_RATIO) {
            if (seen.has(key) || timers.has(key)) continue
            timers.set(key, setTimeout(() => {
              timers.delete(key)
              trackImpression(kind, id)
              obs.unobserve(el) // ya contada: no hace falta seguir mirándola
            }, DWELL_MS))
          } else {
            const t = timers.get(key)
            if (t) { clearTimeout(t); timers.delete(key) }
          }
        }
      },
      { threshold: [0, MIN_RATIO, 1] }
    )
    obsRef.current = obs
    return () => { timers.forEach(clearTimeout); timers.clear(); obs.disconnect(); obsRef.current = null }
  }, [])

  useEffect(() => {
    const obs = obsRef.current
    const root = containerRef.current
    if (!obs || !root) return
    root.querySelectorAll<HTMLElement>('[data-track-id]').forEach((n) => {
      const key = `${n.dataset.kind === 'event' ? 'event' : 'place'}:${n.dataset.trackId}`
      if (!seen.has(key)) obs.observe(n)
    })
  }, [containerRef, watch])
}
