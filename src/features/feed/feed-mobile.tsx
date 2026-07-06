'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Calendar, Search, Sparkles, Heart, Compass, Share2, Ban, Star, MapPin, Users, RefreshCw } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { AccountMenu } from '@/features/auth/components'
import { EventFeedCard } from '@/features/events/EventFeedCard'
import { Notifications } from '@/features/notifications/Notifications'
import { track } from '@/lib/track'
import { directionsHref, fmtDist, type FeedController, type FeedItem, type FeedRow } from './use-feed'

const SCROLL_KEY = 'goospe:feed-scroll'

/**
 * Una card del mazo móvil. Memoizada: con `saved` (boolean) y los callbacks estables
 * del feed, solo se re-renderiza la card afectada al guardar/descartar — no la lista entera.
 * El root sigue siendo `<section data-track-id>` para que el IntersectionObserver funcione.
 */
const FeedCardMobile = memo(function FeedCardMobile({
  p,
  saved,
  priority,
  onSave,
  onShare,
  onDismiss,
  onDirections,
}: {
  p: FeedItem
  saved: boolean
  /** Primera card visible: carga inmediata + alta prioridad (es el LCP del feed). */
  priority?: boolean
  onSave: (p: FeedItem) => void
  onShare: (p: FeedItem) => void
  onDismiss: (id: string) => void
  onDirections: (p: FeedItem) => void
}) {
  const Cat = categoryIcon(p.category_emoji)
  const [imgError, setImgError] = useState(false)
  return (
    <section data-track-id={p.id} data-kind="place" className="relative h-[100dvh] w-full snap-start snap-always">
      {/* foto */}
      {p.photo_url && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.photo_url}
          alt={p.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setImgError(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-goospe-gradient">
          <img src="/brand/isotipo-white.svg" alt="" className="h-20 w-20 opacity-90" />
        </div>
      )}
      {/* overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

      {/* pills superiores: categoría + destacado. El offset incluye var(--sat) para quedar
          bajo el header flotante (que también baja con el safe-area en la app nativa). */}
      <div className="absolute left-4 right-20 top-[calc(8rem+var(--sat))] z-10 flex flex-wrap gap-2">
        {p.category_name && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur">
            <Cat size={13} strokeWidth={2} /> {p.category_name}
          </span>
        )}
        {p.boosted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/40">
            <Sparkles size={13} strokeWidth={2} /> Destacado
          </span>
        )}
      </div>

      {/* acciones laterales */}
      <div className="text-shadow-photo absolute bottom-40 right-4 z-10 flex flex-col gap-5 text-white">
        <button onClick={() => onSave(p)} aria-pressed={saved} aria-label={saved ? 'Quitar de guardados' : 'Guardar'} className="flex flex-col items-center gap-1">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${saved ? 'bg-goospe-green' : 'bg-white/20'}`}>
            <Heart size={22} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
          </span>
          <span className="text-xs">Guardar</span>
        </button>
        <a
          href={directionsHref(p.lat, p.lng)}
          target="_blank"
          rel="noreferrer"
          onClick={() => onDirections(p)}
          className="flex flex-col items-center gap-1"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Compass size={22} strokeWidth={1.75} /></span>
          <span className="text-xs">Cómo llego</span>
        </a>
        <button onClick={() => onShare(p)} className="flex flex-col items-center gap-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Share2 size={20} strokeWidth={1.75} /></span>
          <span className="text-xs">Compartir</span>
        </button>
        <button onClick={() => onDismiss(p.id)} aria-label="Descartar este lugar" className="flex flex-col items-center gap-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30"><Ban size={20} strokeWidth={1.75} /></span>
          <span className="text-xs">Paso</span>
        </button>
      </div>

      {/* info — pr-20 deja espacio a las acciones laterales; pb-28 a la barra Decídeme */}
      <div className="text-shadow-photo absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-28 pr-20 text-white">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span>{fmtDist(p.distance_m)}</span>
          {p.rating > 0 && <><span>·</span><span className="inline-flex items-center gap-1"><Star size={13} strokeWidth={1.75} fill="currentColor" /> {Number(p.rating).toFixed(1)}</span></>}
          {p.price_level ? <><span>·</span><span>{'$'.repeat(p.price_level)}</span></> : null}
        </div>
        <Link href={`/places/${p.slug}`} className="block">
          <h2 className="text-3xl font-medium leading-tight drop-shadow">{p.name}</h2>
        </Link>
        {p.vibe_line && <p className="text-lg font-medium text-goospe-green-light drop-shadow">{p.vibe_line}</p>}
        {p.reviews_count > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs text-white ring-1 ring-white/15 backdrop-blur">
            <Users size={12} strokeWidth={2} /> A {p.reviews_count} {p.reviews_count === 1 ? 'persona' : 'personas'} les gustó
          </span>
        )}
        {p.description && <p className="line-clamp-2 max-w-md text-sm text-white/80">{p.description}</p>}
        {p.tags && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {p.tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs backdrop-blur">{t}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

/**
 * Feed móvil — mazo de decisión inmersivo (oscuro, scroll vertical con snap).
 * Mantiene la interacción TikTok del producto; el estilo de cada card sigue el
 * mock `03 · Feed — mazo de decisión` (context strip, pill de categoría, prueba social).
 */
export function FeedMobile({ feed }: { feed: FeedController }) {
  const { feedList, isSaved, onSave, onDismiss, onShare, onDirections, location, whenLabel, geoSource, retryLocation } = feed
  const containerRef = useRef<HTMLElement>(null)
  const seenCards = useRef<Set<string>>(new Set())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const obsRef = useRef<IntersectionObserver | null>(null)

  // view_card: registra una vista cuando la card permanece visible ≥2s (señal de interés).
  // El observer se crea UNA sola vez (antes se reconstruía con cada cambio de feedList).
  useEffect(() => {
    const timers = timersRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          const id = el.dataset.trackId
          if (!id) continue
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            if (seenCards.current.has(id) || timers.has(id)) continue
            const isEvent = el.dataset.kind === 'event'
            timers.set(id, setTimeout(() => {
              track('view_card', isEvent ? { eventId: id } : { placeId: id })
              seenCards.current.add(id)
              timers.delete(id)
            }, 2000))
          } else {
            const t = timers.get(id)
            if (t) { clearTimeout(t); timers.delete(id) }
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    obsRef.current = obs
    return () => { timers.forEach(clearTimeout); timers.clear(); obs.disconnect(); obsRef.current = null }
  }, [])

  // Al cambiar la lista solo se observan los nodos nuevos (observe() es idempotente).
  useEffect(() => {
    const obs = obsRef.current
    const root = containerRef.current
    if (!obs || !root) return
    root.querySelectorAll('section[data-track-id]').forEach((n) => obs.observe(n))
  }, [feedList])

  // Persistir la posición de scroll → volver al mismo punto tras visitar una ficha (3.25).
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; try { sessionStorage.setItem(SCROLL_KEY, String(root.scrollTop)) } catch {} })
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => { if (raf) cancelAnimationFrame(raf); root.removeEventListener('scroll', onScroll) }
  }, [])

  // Restaurar el scroll una vez que hay contenido renderizado.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || !feedList.length || !containerRef.current) return
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0)
      if (y > 0) containerRef.current.scrollTop = y
    } catch { /* sessionStorage no disponible */ }
    restoredRef.current = true
  }, [feedList])

  // La primera card de lugar es el LCP del feed → se carga con prioridad (el resto, lazy).
  const firstPlaceId = feedList.find((r): r is Extract<FeedRow, { kind: 'place' }> => r.kind === 'place')?.place.id

  return (
    <main ref={containerRef} className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll bg-[#121311]">
      {/* Header overlay: fila 1 (logo + controles) y fila 2 (ubicación + atajos) apiladas en
          una columna fija. El gap garantiza que la fila 2 quede SIEMPRE bajo la fila 1 (sin
          offsets fijos que colisionen). pointer-events-none deja pasar el scroll del feed;
          solo los elementos interactivos reciben pointer-events-auto. */}
      <div className="pointer-events-none fixed inset-x-4 top-[calc(1rem+var(--sat))] z-20 flex flex-col gap-2">
        {/* fila 1 (overlay oscuro → tokens dark) */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/places" className="pointer-events-auto flex min-w-0 items-center gap-2.5 text-white drop-shadow">
            <img src="/brand/logo-white.svg" alt="Goospe" className="h-6 shrink-0" />
            <span className="text-base font-light">Para ti</span>
            {whenLabel && <span className="hidden text-xs text-white/55 min-[380px]:inline">· {whenLabel}</span>}
          </Link>
          <div className="dark pointer-events-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Notifications />
            <AccountMenu />
          </div>
        </div>

        {/* fila 2: ubicación + atajos Eventos / Buscar */}
        <div className="flex flex-wrap items-center gap-2">
          {geoSource === 'fallback' ? (
            // Ubicación real no disponible → las distancias son desde el centro de la ciudad.
            // Chip accionable: toca para reintentar el permiso.
            <button
              onClick={retryLocation}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium text-white ring-1 ring-amber-300/40 backdrop-blur transition hover:bg-amber-400/30"
            >
              <MapPin size={13} strokeWidth={2} className="text-amber-300" /> {location}
              <RefreshCw size={11} strokeWidth={2.5} className="text-amber-200" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur">
              <MapPin size={13} strokeWidth={2} className="text-goospe-green-light" /> {location}
            </span>
          )}
          <Link href="/events" className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25">
            <Calendar size={13} strokeWidth={2} /> Eventos
          </Link>
          <Link href="/search" className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25">
            <Search size={13} strokeWidth={2} /> Buscar
          </Link>
        </div>
      </div>

      {/* conserje (FAB) */}
      <Link
        href="/concierge"
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-goospe-gradient px-6 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/30"
      >
        <Sparkles size={18} strokeWidth={1.75} /> Decídeme
      </Link>

      {feedList.map((row) =>
        row.kind === 'event' ? (
          <EventFeedCard key={`e-${row.event.id}`} ev={row.event} />
        ) : (
          <FeedCardMobile
            key={row.place.id}
            p={row.place}
            saved={isSaved(row.place.id)}
            priority={row.place.id === firstPlaceId}
            onSave={onSave}
            onShare={onShare}
            onDismiss={onDismiss}
            onDirections={onDirections}
          />
        )
      )}

      {/* fin */}
      <section className="flex h-[40vh] snap-start flex-col items-center justify-center gap-2 bg-[#121311] text-white/60">
        <img src="/brand/isotipo-white.svg" alt="" className="h-10 w-10 opacity-50" />
        <p className="text-sm">Eso es todo cerca de ti por ahora</p>
      </section>
    </main>
  )
}
