'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPosition } from '@/lib/geo'
import { useFavorites } from '@/hooks/useFavorites'
import { track } from '@/lib/track'
import type { FeedEvent } from '@/features/events/EventFeedCard'

export type FeedItem = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  description: string | null
  tags: string[] | null
  price_level: number | null
  lat: number
  lng: number
  distance_m: number
  rating: number
  reviews_count: number
  photo_url: string | null
  category_emoji: string | null
  category_name: string | null
  boosted: boolean
}

export type FeedRow = { kind: 'place'; place: FeedItem } | { kind: 'event'; event: FeedEvent }

export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

/** Enlace a indicaciones en Google Maps para unas coordenadas. */
export const directionsHref = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// Ciudad del piloto (ver memoria del proyecto). Mostrada en el context strip del feed.
const LOCATION_LABEL = 'Puerto Varas'

const DISMISSED_KEY = 'goospe:dismissed'
const loadDismissed = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')) } catch { return new Set() }
}

// Intercala un evento cada `gap` lugares (los eventos vienen priorizados por boost/fecha).
function interleave(places: FeedItem[], events: FeedEvent[], gap = 5): FeedRow[] {
  const out: FeedRow[] = []
  let ei = 0
  places.forEach((p, i) => {
    out.push({ kind: 'place', place: p })
    if ((i + 1) % gap === 0 && ei < events.length) out.push({ kind: 'event', event: events[ei++] })
  })
  while (ei < events.length) out.push({ kind: 'event', event: events[ei++] }) // los que sobren, al final
  return out
}

export type FeedController = ReturnType<typeof useFeed>

/**
 * Estado y acciones del feed, compartidos por los tres layouts (móvil / tablet / web).
 * Hace una sola carga de datos: lo monta `page.tsx` y pasa el resultado a cada layout.
 */
export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isSaved, toggle } = useFavorites()
  const supabase = useMemo(() => createClient(), [])
  const dismissed = useRef<Set<string>>(new Set())

  const fetchFeed = useCallback(async (lat: number, lng: number) => {
    // `as never` en los args: workaround del tipado de rpc de supabase-js para funciones
    // que retornan tabla (infiere los args como undefined). El runtime es correcto.
    const [places, evs] = await Promise.all([
      supabase.rpc('get_feed', { p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: 40, p_offset: 0 } as never),
      supabase.rpc('get_feed_events', { p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: 8 } as never),
    ])
    if (places.error) setError(places.error.message)
    else setItems(((places.data ?? []) as FeedItem[]).filter((p) => !dismissed.current.has(p.id)))
    setEvents((evs.data ?? []) as FeedEvent[])
    setLoading(false)
  }, [supabase])

  const feedList = useMemo(() => interleave(items, events), [items, events])

  useEffect(() => {
    dismissed.current = loadDismissed()
    getPosition().then(({ lat, lng }) => fetchFeed(lat, lng))
  }, [fetchFeed])

  const onSave = useCallback((p: FeedItem) => {
    track(isSaved(p.id) ? 'unsave' : 'save', { placeId: p.id })
    toggle(p.id)
  }, [isSaved, toggle])

  const onDismiss = useCallback((id: string) => {
    track('dismiss', { placeId: id })
    dismissed.current.add(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed.current]))
    setItems((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const onShare = useCallback((p: FeedItem) => {
    track('share', { placeId: p.id })
    navigator.share?.({ title: p.name, text: p.vibe_line ?? p.name, url: `${location.origin}/places/${p.slug}` }).catch(() => {})
  }, [])

  const onDirections = useCallback((p: FeedItem) => track('directions', { placeId: p.id }), [])

  // "jue · 19:30" — momento actual, para el encabezado "Para ti".
  const whenLabel = useMemo(() => {
    try {
      const d = new Date()
      const day = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
      const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      return `${day} · ${time}`
    } catch { return '' }
  }, [])

  return {
    items, events, feedList, loading, error,
    isSaved, onSave, onDismiss, onShare, onDirections,
    location: LOCATION_LABEL, whenLabel,
  }
}
