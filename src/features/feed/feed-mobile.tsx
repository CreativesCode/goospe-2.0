'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Calendar, Search, Sparkles, Heart, Compass, Share2, Ban, Star, MapPin, Users } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { AccountMenu } from '@/features/auth/components'
import { EventFeedCard } from '@/features/events/EventFeedCard'
import { Notifications } from '@/features/notifications/Notifications'
import { track } from '@/lib/track'
import { directionsHref, fmtDist, type FeedController, type FeedItem } from './use-feed'

/**
 * Feed móvil — mazo de decisión inmersivo (oscuro, scroll vertical con snap).
 * Mantiene la interacción TikTok del producto; el estilo de cada card sigue el
 * mock `03 · Feed — mazo de decisión` (context strip, pill de categoría, prueba social).
 */
export function FeedMobile({ feed }: { feed: FeedController }) {
  const { feedList, isSaved, onSave, onDismiss, onShare, onDirections, location, whenLabel } = feed
  const containerRef = useRef<HTMLElement>(null)
  const seenCards = useRef<Set<string>>(new Set())

  // view_card: registra una vista cuando la card permanece visible ≥2s (señal de interés).
  useEffect(() => {
    if (!feedList.length || !containerRef.current) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
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
    containerRef.current.querySelectorAll('section[data-track-id]').forEach((n) => obs.observe(n))
    return () => { timers.forEach(clearTimeout); obs.disconnect() }
  }, [feedList])

  return (
    <main ref={containerRef} className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll bg-[#121311]">
      {/* fila 1: logo + "Para ti · hora"  |  controles (overlay oscuro → tokens dark) */}
      <div className="fixed inset-x-4 top-4 z-20 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 text-white drop-shadow">
          <Link href="/places" className="shrink-0">
            <img src="/brand/logo-white.svg" alt="Goospe" className="h-6" />
          </Link>
          <span className="text-base font-light">Para ti</span>
          {whenLabel && <span className="hidden text-xs text-white/55 min-[380px]:inline">· {whenLabel}</span>}
        </div>
        <div className="dark flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Notifications />
          <AccountMenu />
        </div>
      </div>

      {/* fila 2: ubicación + atajos Eventos / Buscar */}
      <div className="fixed left-4 top-14 z-20 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur">
          <MapPin size={13} strokeWidth={2} className="text-goospe-green-light" /> {location}
        </span>
        <Link href="/eventos" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25">
          <Calendar size={13} strokeWidth={2} /> Eventos
        </Link>
        <Link href="/buscar" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25">
          <Search size={13} strokeWidth={2} /> Buscar
        </Link>
      </div>

      {/* conserje (FAB) */}
      <Link
        href="/concierge"
        className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-goospe-gradient px-6 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/30"
      >
        <Sparkles size={18} strokeWidth={1.75} /> Decídeme
      </Link>

      {feedList.map((row) => {
        if (row.kind === 'event') return <EventFeedCard key={`e-${row.event.id}`} ev={row.event} />
        const p = row.place
        const Cat = categoryIcon(p.category_emoji)
        return (
          <section key={p.id} data-track-id={p.id} data-kind="place" className="relative h-[100dvh] w-full snap-start snap-always">
            {/* foto */}
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-goospe-gradient">
                <img src="/brand/isotipo-white.svg" alt="" className="h-20 w-20 opacity-90" />
              </div>
            )}
            {/* overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

            {/* pills superiores: categoría + destacado */}
            <div className="absolute left-4 right-20 top-32 z-10 flex flex-wrap gap-2">
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
              <button onClick={() => onSave(p)} className="flex flex-col items-center gap-1">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${isSaved(p.id) ? 'bg-goospe-green' : 'bg-white/20'}`}>
                  <Heart size={22} strokeWidth={1.75} fill={isSaved(p.id) ? 'currentColor' : 'none'} />
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
              <button onClick={() => onDismiss(p.id)} className="flex flex-col items-center gap-1">
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
      })}

      {/* fin */}
      <section className="flex h-[40vh] snap-start flex-col items-center justify-center gap-2 bg-[#121311] text-white/60">
        <img src="/brand/isotipo-white.svg" alt="" className="h-10 w-10 opacity-50" />
        <p className="text-sm">Eso es todo cerca de ti por ahora</p>
      </section>
    </main>
  )
}
