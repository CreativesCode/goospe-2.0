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
import { CITY_EVENT } from '@/lib/city-choice'
import { getCityChoice } from '@/features/city/city-store'
import { cursorArgs, cursorOf, isStalledPage, mergePage, pageIsFull, positionKey, type FeedCursor } from './feed-cursor'
import { clearFeedScroll } from './use-scroll-restore'

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
  /** Puntaje del ranking: con distance_m e id forma el cursor de paginación. */
  score?: number
  // Desde la migración 0035 (opcionales: el feed funciona igual sin ellas).
  hours?: { osm_raw?: string | null } | null
  timezone?: string | null
}

export type FeedRow = { kind: 'place'; place: FeedItem } | { kind: 'event'; event: FeedEvent }

export { fmtDist, fmtEta, fmtDistDrive, directionsHref } from './feed-format'

// Etiqueta por defecto del context strip mientras la cobertura resuelve la ciudad real de la
// ubicación del usuario (ver `cityName` más abajo, que la reemplaza). Genérica: nunca fijamos
// una ciudad concreta para no mostrar "otra ciudad" a quien abre desde fuera del piloto.
const LOCATION_LABEL = 'Tu zona'

// Tamaño de página del feed. Debe coincidir con el p_limit de la tanda SSR (app/feed/page.tsx).
const FEED_PAGE = 40
const FEED_RADIUS_M = 25000

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
// Los eventos que sobran van al final SOLO cuando ya no quedan páginas (`flushRest`): si se
// añadieran antes, al cargar más lugares cambiarían de sitio bajo el dedo del usuario.
function interleave(places: FeedItem[], events: FeedEvent[], flushRest: boolean, gap = 5): FeedRow[] {
  const out: FeedRow[] = []
  let ei = 0
  places.forEach((p, i) => {
    out.push({ kind: 'place', place: p })
    if ((i + 1) % gap === 0 && ei < events.length) out.push({ kind: 'event', event: events[ei++] })
  })
  if (flushRest) while (ei < events.length) out.push({ kind: 'event', event: events[ei++] })
  return out
}

// ── Sesión de feed en memoria ─────────────────────────────────────────────────────────────────
// Lo ya cargado (todas las páginas + cursor) sobrevive a la navegación dentro de la app: al
// volver de una ficha el feed reaparece donde estaba, sin pedir nada ni recolocar las cards.
// Vale para una posición concreta y caduca sola; una recarga completa del navegador empieza de cero.
type FeedSession = {
  key: string
  /** Ciudad elegida a mano con la que se cargó (null = "cerca de mí"). */
  cityId: number | null
  at: number
  items: FeedItem[]
  events: FeedEvent[]
  cursor: FeedCursor | null
  /** Ids de las filas CRUDAS recibidas (su tamaño es el offset si hay que paginar sin cursor). */
  seen: Set<string>
  hasMore: boolean
}
const SESSION_TTL_MS = 10 * 60 * 1000
let session: FeedSession | null = null

const liveSession = (key: string) =>
  session && session.key === key && Date.now() - session.at < SESSION_TTL_MS ? session : null

// Sesión con la que ARRANCAR al montar (volver al feed desde una ficha): la última, si sigue
// viva y es de la misma ciudad elegida. Se pinta de inmediato, antes de resolver la ubicación;
// si después la posición resulta ser otra, fetchFeed la reemplaza. En el servidor y en una
// carga completa del navegador no hay sesión (el módulo empieza vacío).
function resumableSession(): FeedSession | null {
  if (typeof window === 'undefined' || !session) return null
  if (Date.now() - session.at >= SESSION_TTL_MS) return null
  return session.cityId === (getCityChoice()?.id ?? null) ? session : null
}

// PostgREST responde PGRST202 si la función no acepta esos argumentos: la BD todavía no tiene
// la migración 0043. Se sigue paginando por offset (comportamiento anterior) en vez de cortar.
const isMissingCursorParams = (err: { code?: string; message?: string }) =>
  err.code === 'PGRST202' || /p_after_/.test(err.message ?? '')

export type FeedController = ReturnType<typeof useFeed>

/**
 * Estado y acciones del feed, compartidos por los tres layouts (móvil / tablet / web).
 * Hace una sola carga de datos: lo monta `page.tsx` y pasa el resultado a cada layout.
 *
 * `initial` (opcional): primera tanda renderizada en el servidor con la ubicación por defecto
 * (centro por defecto). Si viene, el feed arranca SIN loading (pinta al instante) y refina la
 * ubicación real en segundo plano; si no, comportamiento previo (loading hasta geo + RPC).
 */
export function useFeed(initial?: { items: FeedItem[]; events: FeedEvent[] } | null) {
  // Al volver de una ficha el feed arranca con TODO lo que ya estaba cargado (sesión en
  // memoria), no con la tanda SSR de 40: así el scroll se puede restaurar más allá de la
  // primera página y no hay salto de contenido.
  const [resumed] = useState(() => {
    const kept = resumableSession()
    if (!kept) return null
    const gone = loadDismissed()
    return { ...kept, items: kept.items.filter((p) => !gone.has(p.id)) }
  })
  const [items, setItems] = useState<FeedItem[]>(resumed?.items ?? initial?.items ?? [])
  const [events, setEvents] = useState<FeedEvent[]>(resumed?.events ?? initial?.events ?? [])
  const [loading, setLoading] = useState(!initial && !resumed)
  // true cuando la lista en pantalla ya es la definitiva (sesión retomada o primera carga con
  // la ubicación real), no la semilla SSR. Los layouts esperan a esto para restaurar el scroll.
  const [settled, setSettled] = useState(!!resumed)
  const [error, setError] = useState<string | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')
  // Cobertura: 'pending' hasta resolver; 'uncovered' bloquea el feed (pantalla "pronto").
  const [coverage, setCoverage] = useState<'pending' | 'covered' | 'uncovered'>('pending')
  // Dentro de cobertura pero el feed volvió sin lugares NI eventos → feed-client muestra <ComingSoonScreen>.
  const [emptyZone, setEmptyZone] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  // Nombre de la ciudad activa que cubre la ubicación real (lo devuelve resolve_coverage), o la
  // elegida a mano. Reemplaza la etiqueta genérica del chip de ubicación.
  const [cityName, setCityName] = useState<string | null>(null)
  const { isSaved, toggle } = useFavorites()
  const supabase = useMemo(() => createClient(), [])
  const dismissed = useRef<Set<string>>(new Set())
  const itemsRef = useRef<FeedItem[]>([]) // espejo estable para leer en onDismiss (deshacer)
  // Paginación por cursor (ver feed-cursor.ts). `hasMore` mientras la última página vino llena.
  // `posRef` = posición con la que se pidió la primera página; mientras sea null (seed SSR aún
  // sin refinar) no se pagina. Arranca en false: la tanda SSR es de la ubicación por defecto.
  const [hasMore, setHasMore] = useState(resumed?.hasMore ?? false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Nº de páginas recibidas: los layouts lo usan para re-armar el centinela de scroll infinito.
  const [feedPage, setFeedPage] = useState(0)
  const posRef = useRef<{ lat: number; lng: number } | null>(null)
  const cursorRef = useRef<FeedCursor | null>(null)
  // Ids de las filas CRUDAS recibidas. Su tamaño es el offset de respaldo (BD sin cursor o
  // cursor atascado); se cuentan ids y no filas porque una página por cursor puede repetir
  // la última fila de la anterior (ver feed-cursor.ts).
  const seenRef = useRef<Set<string>>(new Set())
  const eventsRef = useRef<FeedEvent[]>([])
  const busyRef = useRef(false)
  const reqRef = useRef(0) // invalida páginas pedidas antes de recargar el feed

  // Guarda lo cargado para retomarlo al volver al feed (misma posición).
  const remember = useCallback((list: FeedItem[], more: boolean) => {
    const pos = posRef.current
    if (!pos) return
    session = {
      key: positionKey(pos.lat, pos.lng), cityId: getCityChoice()?.id ?? null,
      at: Date.now(), items: list, events: eventsRef.current,
      cursor: cursorRef.current, seen: seenRef.current, hasMore: more,
    }
  }, [])

  const fetchFeed = useCallback(async (lat: number, lng: number) => {
    const req = ++reqRef.current
    // Una página en vuelo de la carga anterior ya no cuenta (su respuesta se descarta por `req`).
    busyRef.current = false
    setLoadingMore(false)

    const kept = liveSession(positionKey(lat, lng))
    if (kept) {
      posRef.current = { lat, lng }
      cursorRef.current = kept.cursor
      seenRef.current = kept.seen
      eventsRef.current = kept.events
      setItems(kept.items.filter((p) => !dismissed.current.has(p.id)))
      setEvents(kept.events)
      setHasMore(kept.hasMore)
      setFeedPage((n) => n + 1)
      setEmptyZone(false)
      setLoading(false)
      setSettled(true)
      return
    }

    // `as never` en los args: workaround del tipado de rpc de supabase-js para funciones
    // que retornan tabla (infiere los args como undefined). El runtime es correcto.
    const [places, evs] = await Promise.all([
      supabase.rpc('get_feed', { p_lat: lat, p_lng: lng, p_radius_m: FEED_RADIUS_M, p_limit: FEED_PAGE, p_offset: 0 } as never),
      supabase.rpc('get_feed_events', { p_lat: lat, p_lng: lng, p_radius_m: FEED_RADIUS_M, p_limit: 8 } as never),
    ])
    if (req !== reqRef.current) return // llegó tarde: ya hay una carga más reciente
    const placeRows = (places.data ?? []) as FeedItem[]
    const eventRows = (evs.data ?? []) as FeedEvent[]
    eventsRef.current = eventRows
    if (places.error) setError(places.error.message)
    else {
      const more = pageIsFull(placeRows.length, FEED_PAGE)
      posRef.current = { lat, lng }
      cursorRef.current = cursorOf(placeRows)
      seenRef.current = new Set(placeRows.map((p) => p.id))
      setItems(placeRows.filter((p) => !dismissed.current.has(p.id)))
      setHasMore(more)
      setFeedPage((n) => n + 1)
      if (placeRows.length) remember(placeRows, more)
    }
    setEvents(eventRows)
    // Zona activa pero sin datos: se mide sobre las filas crudas (no lo descartado) para no
    // confundir "zona vacía" con "ya viste todo".
    setEmptyZone(!places.error && placeRows.length === 0 && eventRows.length === 0)
    setLoading(false)
    setSettled(true)
  }, [supabase, remember])

  // Siguiente página (scroll infinito). Ignora llamadas mientras hay una en vuelo.
  const loadMore = useCallback(async () => {
    const pos = posRef.current
    if (!pos || busyRef.current) return
    busyRef.current = true
    setLoadingMore(true)
    const req = reqRef.current
    const base = { p_lat: pos.lat, p_lng: pos.lng, p_radius_m: FEED_RADIUS_M, p_limit: FEED_PAGE }
    const byOffset = () => supabase.rpc('get_feed', { ...base, p_offset: seenRef.current.size } as never)
    const cursor = cursorRef.current
    let res = cursor
      ? await supabase.rpc('get_feed', { ...base, p_offset: 0, ...cursorArgs(cursor) } as never)
      : await byOffset()
    if (cursor && res.error && isMissingCursorParams(res.error)) {
      cursorRef.current = null // el resto de la sesión pagina por offset
      res = await byOffset()
    }
    // Cursor atascado (una página entera de filas ya vistas): el resto de la sesión va por offset.
    if (cursorRef.current && !res.error && isStalledPage((res.data ?? []) as FeedItem[], seenRef.current, FEED_PAGE)) {
      cursorRef.current = null
      res = await byOffset()
    }
    if (req !== reqRef.current) return // el feed se recargó mientras tanto (fetchFeed ya soltó `busyRef`)
    busyRef.current = false
    setLoadingMore(false)
    if (res.error) { setHasMore(false); return } // sin bucle de reintentos; "reintentar" recarga el feed
    const rows = (res.data ?? []) as FeedItem[]
    const more = pageIsFull(rows.length, FEED_PAGE)
    for (const row of rows) seenRef.current.add(row.id)
    if (cursorRef.current) cursorRef.current = cursorOf(rows) ?? cursorRef.current
    // La unión deduplica por id: si el score de un lugar ya mostrado baja entre páginas
    // (tendencias, fin de un boost) el servidor puede devolverlo otra vez.
    const merged = mergePage(itemsRef.current, rows, dismissed.current)
    itemsRef.current = merged
    setItems(merged)
    setHasMore(more)
    setFeedPage((n) => n + 1)
    remember(merged, more)
  }, [supabase, remember])

  const feedList = useMemo(() => interleave(items, events, !hasMore), [items, events, hasMore])
  useEffect(() => { itemsRef.current = items }, [items])

  // Resuelve ubicación → carga feed. Reutilizable como "reintentar" si el usuario
  // activa el permiso después de haber caído al fallback (centro por defecto). Con `background`
  // (refine sobre un seed SSR) no muestra el loader: el contenido ya está en pantalla.
  const loadPosition = useCallback((opts?: { background?: boolean; allowFallback?: boolean }) => {
    if (!opts?.background) setLoading(true)
    setError(null) // limpia un error previo al reintentar
    setEmptyZone(false) // limpia el estado "zona vacía" al reintentar
    getPosition().then(async (pos) => {
      setGeoSource(pos.source)
      setCoords({ lat: pos.lat, lng: pos.lng })
      // Ciudad elegida a mano: es una ciudad activa por definición → sin gate de ubicación ni de
      // cobertura, y el rótulo es el suyo.
      if (pos.source === 'city') {
        setCityName(pos.city?.name ?? null)
        setCoverage('covered')
        fetchFeed(pos.lat, pos.lng)
        return
      }
      setCityName(null)
      // Sin ubicación real (permiso denegado / timeout / sin soporte) NO mostramos el centro por defecto a
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
        const city = await resolveCoverage(pos.lat, pos.lng)
        covered = city !== null
        if (city) setCityName(city.name) // rótulo real de la ciudad, no la constante del piloto
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
    // El seed SSR es de la ubicación por defecto: con una ciudad elegida a mano no sirve (mostraría
    // otra ciudad un instante). Se descarta ANTES de pintar: feed-client enseña el loader hasta
    // que se resuelve el breakpoint, que ocurre en este mismo ciclo de efectos.
    if (resumed || (initial && !getCityChoice())) {
      // Sesión retomada o seed SSR: filtra descartados y refina la ubicación real sin loader.
      setItems((prev) => prev.filter((p) => !dismissed.current.has(p.id)))
      loadPosition({ background: true })
    } else {
      if (initial) { setItems([]); setEvents([]) }
      loadPosition()
    }
    // `initial` y `resumed` se leen una sola vez al montar (props del servidor / estado fijo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPosition])

  // Cambio de ciudad desde el selector (o vuelta a "cerca de mí"): recarga con la nueva posición.
  useEffect(() => {
    const onCity = () => {
      // Otra ciudad = otro feed: la posición de scroll guardada ya no significa nada.
      clearFeedScroll()
      setCoverage('pending')
      setHasMore(false)
      posRef.current = null
      loadPosition()
    }
    window.addEventListener(CITY_EVENT, onCity)
    return () => window.removeEventListener(CITY_EVENT, onCity)
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

  // "jue · 19:30" — momento actual (hora del dispositivo, reloj de 24 h), para "Para ti".
  const whenLabel = useMemo(() => {
    try {
      const d = new Date()
      const day = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
      const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      return `${day} · ${time}`
    } catch { return '' }
  }, [])

  return {
    items, events, feedList, loading, error,
    hasMore, loadingMore, loadMore, feedPage, settled,
    geoSource, retryLocation, continueWithFallback, coverage, emptyZone, coords,
    isSaved, onSave, onDismiss, onShare, onDirections,
    location: cityName ?? LOCATION_LABEL, whenLabel,
  }
}
