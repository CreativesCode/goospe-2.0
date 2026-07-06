'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPosition, type GeoSource } from '@/lib/geo'
import { resolveCoverage } from '@/features/coverage/services/coverage'
import { logCoverageRequest } from '@/actions/coverage-request'
import { useFavorites } from '@/hooks/useFavorites'
import { track } from '@/lib/track'
import { toast } from '@/shared/components/toast'
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
const ZONE_LOGGED_KEY = 'goospe:zone-logged'

// Registra (una sola vez por zona y navegador) una apertura fuera de cobertura, para que el panel
// admin sepa desde dónde abren la app zonas aún no cubiertas. Best-effort: cualquier fallo se ignora.
function logUncoveredZone(lat: number, lng: number) {
  try {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}` // ~1 km: no repetir por micro-movimientos
    const seen = new Set<string>(JSON.parse(localStorage.getItem(ZONE_LOGGED_KEY) ?? '[]'))
    if (seen.has(key)) return
    seen.add(key)
    localStorage.setItem(ZONE_LOGGED_KEY, JSON.stringify([...seen]))
    void logCoverageRequest({
      lat,
      lng,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    })
  } catch {
    // sin acceso a localStorage / server action caída → no pasa nada
  }
}
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
 *
 * `initial` (opcional): primera tanda renderizada en el servidor con la ubicación por defecto
 * (Puerto Varas). Si viene, el feed arranca SIN loading (pinta al instante) y refina la
 * ubicación real en segundo plano; si no, comportamiento previo (loading hasta geo + RPC).
 */
export function useFeed(initial?: { items: FeedItem[]; events: FeedEvent[] } | null) {
  const [items, setItems] = useState<FeedItem[]>(initial?.items ?? [])
  const [events, setEvents] = useState<FeedEvent[]>(initial?.events ?? [])
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState<string | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')
  // Cobertura: 'pending' hasta resolver; 'uncovered' bloquea el feed (pantalla "pronto").
  const [coverage, setCoverage] = useState<'pending' | 'covered' | 'uncovered'>('pending')
  // Dentro de cobertura pero el feed volvió sin lugares NI eventos → feed-client muestra <ComingSoonScreen>.
  const [emptyZone, setEmptyZone] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const { isSaved, toggle } = useFavorites()
  const supabase = useMemo(() => createClient(), [])
  const dismissed = useRef<Set<string>>(new Set())
  const itemsRef = useRef<FeedItem[]>([]) // espejo estable para leer en onDismiss (deshacer)

  const fetchFeed = useCallback(async (lat: number, lng: number) => {
    // `as never` en los args: workaround del tipado de rpc de supabase-js para funciones
    // que retornan tabla (infiere los args como undefined). El runtime es correcto.
    const [places, evs] = await Promise.all([
      supabase.rpc('get_feed', { p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: 40, p_offset: 0 } as never),
      supabase.rpc('get_feed_events', { p_lat: lat, p_lng: lng, p_radius_m: 25000, p_limit: 8 } as never),
    ])
    const placeRows = (places.data ?? []) as FeedItem[]
    const eventRows = (evs.data ?? []) as FeedEvent[]
    if (places.error) setError(places.error.message)
    else setItems(placeRows.filter((p) => !dismissed.current.has(p.id)))
    setEvents(eventRows)
    // Zona activa pero sin datos: se mide sobre las filas crudas (no lo descartado) para no
    // confundir "zona vacía" con "ya viste todo".
    setEmptyZone(!places.error && placeRows.length === 0 && eventRows.length === 0)
    setLoading(false)
  }, [supabase])

  const feedList = useMemo(() => interleave(items, events), [items, events])
  useEffect(() => { itemsRef.current = items }, [items])

  // Resuelve ubicación → carga feed. Reutilizable como "reintentar" si el usuario
  // activa el permiso después de haber caído al fallback de Puerto Varas. Con `background`
  // (refine sobre un seed SSR) no muestra el loader: el contenido ya está en pantalla.
  const loadPosition = useCallback((opts?: { background?: boolean; allowFallback?: boolean }) => {
    if (!opts?.background) setLoading(true)
    setError(null) // limpia un error previo al reintentar
    setEmptyZone(false) // limpia el estado "zona vacía" al reintentar
    getPosition().then(async (pos) => {
      setGeoSource(pos.source)
      setCoords({ lat: pos.lat, lng: pos.lng })
      // Sin ubicación real (permiso denegado / timeout / sin soporte) NO mostramos Puerto Varas a
      // ciegas: feed-client renderiza <LocationNeededScreen> pidiendo activar la ubicación.
      // `allowFallback` (botón "explorar de todos modos") salta el gate y usa el centro de la ciudad.
      if (pos.source === 'fallback' && !opts?.allowFallback) {
        setLoading(false)
        return
      }
      // Gate de cobertura: si la posición real cae fuera de toda ciudad activa, no cargamos
      // el feed → feed-client muestra <OutOfCoverageScreen>. Un error de red NO bloquea.
      let covered = true
      try {
        covered = (await resolveCoverage(pos.lat, pos.lng)) !== null
      } catch {
        covered = true
      }
      if (!covered) {
        setCoverage('uncovered')
        setLoading(false)
        // Solo con GPS real: registramos la zona de demanda (el fallback no tiene ubicación fiable).
        if (pos.source === 'gps') logUncoveredZone(pos.lat, pos.lng)
        return
      }
      setCoverage('covered')
      fetchFeed(pos.lat, pos.lng)
    })
  }, [fetchFeed])

  // Reintento manual (botón/onClick): foreground, sin args → evita pasar el MouseEvent como opts.
  const retryLocation = useCallback(() => loadPosition(), [loadPosition])
  // "Explorar de todos modos": el usuario decide continuar sin ubicación real (centro de la ciudad).
  const continueWithFallback = useCallback(() => loadPosition({ allowFallback: true }), [loadPosition])

  useEffect(() => {
    dismissed.current = loadDismissed()
    if (initial) {
      // Seed SSR: filtra descartados y refina la ubicación real sin mostrar el loader.
      setItems((prev) => prev.filter((p) => !dismissed.current.has(p.id)))
      loadPosition({ background: true })
    } else {
      loadPosition()
    }
    // `initial` se lee una sola vez al montar (props estables del servidor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPosition])

  const onSave = useCallback((p: FeedItem) => {
    const saved = toggle(p.id) // devuelve si quedó guardado → evita depender de isSaved
    track(saved ? 'save' : 'unsave', { placeId: p.id })
  }, [toggle])

  // Restaura un lugar descartado en su posición original (lo saca de `dismissed`).
  const restore = useCallback((item: FeedItem, idx: number) => {
    dismissed.current.delete(item.id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed.current]))
    setItems((cur) => (cur.some((p) => p.id === item.id) ? cur : [...cur.slice(0, idx), item, ...cur.slice(idx)]))
  }, [])

  const onDismiss = useCallback((id: string) => {
    const idx = itemsRef.current.findIndex((p) => p.id === id)
    const item = idx >= 0 ? itemsRef.current[idx] : null
    track('dismiss', { placeId: id })
    dismissed.current.add(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed.current]))
    setItems((prev) => prev.filter((p) => p.id !== id))
    // Un toque accidental en "Paso" ya no borra el lugar para siempre.
    if (item) toast.info('Descartado', { action: { label: 'Deshacer', onClick: () => restore(item, idx) } })
  }, [restore])

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
    geoSource, retryLocation, continueWithFallback, coverage, emptyZone, coords,
    isSaved, onSave, onDismiss, onShare, onDirections,
    location: LOCATION_LABEL, whenLabel,
  }
}
