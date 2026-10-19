'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Heart, Compass, Share2, Ban, MapPin, RefreshCw, SlidersHorizontal, ChevronsUp, ArrowUp } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { TabBar } from '@/shared/components/app-nav'
import { PhotoImg } from '@/shared/components/photo-img'
import { EventFeedCard } from '@/features/events/EventFeedCard'
import { Notifications } from '@/features/notifications/Notifications'
import { OpenNowBadge } from '@/features/places/OpenNowBadge'
import { CitySwitcher } from '@/features/city/CitySwitcher'
import { DotList } from './dot-list'
import { LoadMore } from './load-more'
import { useCardImpressions } from './impressions'
import { useDeck } from './use-deck'
import { directionsHref, fmtDistDrive, type FeedController, type FeedItem, type FeedRow } from './use-feed'
import { useScrollRestore } from './use-scroll-restore'

const ACTION = 'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-[6px] transition'
const GLASS = 'bg-white/[0.18]'
// Botones redondos del encabezado sobre la foto (anulan el estilo de superficie del componente).
const OVERLAY_BTN = '!h-10 !w-10 !border-transparent !bg-white/[0.14] !text-white'

/**
 * Una card del mazo móvil. Memoizada: con `saved` (boolean) y los callbacks estables
 * del feed, solo se re-renderiza la card afectada al guardar/descartar — no la lista entera.
 * El root lleva `data-track-id` para que el IntersectionObserver de impresiones funcione.
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
  return (
    <article data-track-id={p.id} data-kind="place" className="relative h-full w-full snap-start snap-always overflow-hidden">
      {/* foto; sin ella (o si no cargó): degradado oscuro de marca + icono de la categoría */}
      <PhotoImg
        src={p.photo_url}
        alt={p.name}
        priority={priority}
        tone="deep"
        className="absolute inset-0 h-full w-full object-cover pb-[200px] [&:is(img)]:pb-0"
        fallback={<Cat size={92} strokeWidth={1.1} />}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,9,0.92),rgba(10,10,9,0.1)_52%,rgba(10,10,9,0.5))]" />

      {/* acciones laterales. z por ENCIMA del bloque de info, que va después en el DOM. */}
      <div className="absolute bottom-7 right-3.5 z-[11] flex flex-col gap-3.5 text-center text-[11px] text-white">
        <button onClick={() => onSave(p)} aria-pressed={saved} aria-label={saved ? 'Quitar de guardados' : 'Guardar'}>
          <span className={`${ACTION} ${saved ? 'bg-goospe-green text-on-brand' : GLASS}`}>
            <Heart size={21} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
          </span>
          <span className="mt-1 block">{saved ? 'Guardado' : 'Guardar'}</span>
        </button>
        <a href={directionsHref(p.lat, p.lng)} target="_blank" rel="noreferrer" onClick={() => onDirections(p)}>
          <span className={`${ACTION} ${GLASS}`}><Compass size={21} strokeWidth={1.75} /></span>
          <span className="mt-1 block">Cómo llego</span>
        </a>
        <button onClick={() => onShare(p)}>
          <span className={`${ACTION} ${GLASS}`}><Share2 size={19} strokeWidth={1.75} /></span>
          <span className="mt-1 block">Compartir</span>
        </button>
        <button onClick={() => onDismiss(p.id)} aria-label="Paso: descartar este lugar">
          <span className={`${ACTION} ${GLASS}`}><Ban size={19} strokeWidth={1.75} /></span>
          <span className="mt-1 block">Paso</span>
        </button>
      </div>

      {/* info */}
      <div className="text-shadow-photo absolute bottom-7 left-[18px] right-[84px] z-10 text-white">
        <div className="mb-2.5 flex flex-wrap gap-1.5 [text-shadow:none]">
          <OpenNowBadge hours={p.hours} timezone={p.timezone} className="!px-2.5 !py-[5px] !text-[11px]" />
          {p.category_name && (
            <span className="inline-flex items-center gap-[5px] rounded-full bg-white/[0.16] px-2.5 py-1 text-[11px] leading-none">
              <Cat size={12} strokeWidth={2} /> {p.category_name}
            </span>
          )}
          {p.boosted && (
            <span className="inline-flex items-center gap-[5px] rounded-full bg-goospe-gradient px-2.5 py-1 text-[11px] font-medium leading-none text-on-brand">
              <Sparkles size={12} strokeWidth={2} /> Destacado
            </span>
          )}
        </div>
        <DotList className="flex flex-wrap items-center gap-1.5 text-[13px] text-white/[0.82]">
          <span>{fmtDistDrive(p.distance_m)}</span>
          {p.rating > 0 ? <span>★ {Number(p.rating).toFixed(1)}</span> : null}
          {p.price_level ? <span>{'$'.repeat(p.price_level)}</span> : null}
        </DotList>
        <Link href={`/places/${p.slug}`} className="mt-1 block">
          <h2 className="text-[30px] font-medium leading-[1.1]">{p.name}</h2>
        </Link>
        {p.vibe_line && <p className="mt-1 text-[17px] font-medium text-goospe-green-light">{p.vibe_line}</p>}
        {p.description && <p className="mt-2 line-clamp-3 text-sm leading-[1.45] text-white/[0.82]">{p.description}</p>}
      </div>
    </article>
  )
})

/** Indicador de posición: barras verticales a la derecha, en una ventana alrededor de la activa. */
function DeckDots({ count, active }: { count: number; active: number }) {
  const WINDOW = 9
  const start = Math.max(0, Math.min(active - Math.floor(WINDOW / 2), count - WINDOW))
  const dots = Array.from({ length: Math.min(count, WINDOW) }, (_, i) => start + i)
  return (
    <div aria-hidden className="pointer-events-none absolute right-[5px] top-1/2 z-10 flex -translate-y-1/2 flex-col gap-[5px]">
      {dots.map((i) => (
        <span key={i} className={`w-[3px] rounded-full transition-[height] duration-200 ${i === active ? 'h-[18px] bg-goospe-green-light' : 'h-1.5 bg-white/40'}`} />
      ))}
    </div>
  )
}

/**
 * Feed móvil — mazo de decisión inmersivo: una tarjeta por pantalla con scroll vertical y snap,
 * encabezado y chips flotando sobre la foto y la tab bar oscura debajo. Los eventos se
 * intercalan como tarjetas del mazo; con un filtro de categoría activo solo quedan lugares.
 */
export function FeedMobile({ feed }: { feed: FeedController }) {
  const { feedList, isSaved, onSave, onDismiss, onShare, onDirections, location, geoSource, retryLocation, hasMore, loadingMore, loadMore, feedPage, settled } = feed
  const deck = useDeck()
  const { ref: deckRef, active, jumpTo } = deck
  const [cat, setCat] = useState<string | null>(null)

  // Categorías presentes en los datos → chips "Todo" + categorías.
  const categories = useMemo(() => {
    const set = new Set<string>()
    feedList.forEach((r) => { if (r.kind === 'place' && r.place.category_name) set.add(r.place.category_name) })
    return [...set].slice(0, 5)
  }, [feedList])

  const rows = useMemo(
    () => (cat ? feedList.filter((r) => r.kind === 'place' && r.place.category_name === cat) : feedList),
    [feedList, cat]
  )

  // Otra categoría = otro mazo: vuelve a la primera tarjeta.
  useEffect(() => { jumpTo(0, true) }, [cat, jumpTo])

  // view_card: una vista cuando la card permanece visible ≥2 s (señal de interés). Una sola vez
  // por card aunque se vuelva de una ficha o lleguen más páginas (ver impressions.ts).
  useCardImpressions(deckRef, rows)

  // Volver al mismo punto tras visitar una ficha. Se restaura cuando la lista es la definitiva
  // (`settled`), no contra la tanda SSR de 40 cards.
  useScrollRestore('mobile', settled && feedList.length > 0, { target: deckRef })

  // La primera card de lugar es el LCP del feed → se carga con prioridad (el resto, lazy).
  const firstPlaceId = rows.find((r): r is Extract<FeedRow, { kind: 'place' }> => r.kind === 'place')?.place.id

  return (
    <>
      <main className="relative h-[calc(100dvh-64px-var(--sab))] overflow-hidden bg-[#121311]">
        <div
          // key: al cambiar la tanda SSR por la lista real el contenedor se monta de nuevo. Sin esto
          // el navegador re-ajusta el snap siguiendo a la tarjeta que estaba en pantalla, que en la
          // lista real puede haber quedado en la posición 30.
          key={settled ? 'live' : 'seed'}
          ref={deckRef}
          onScroll={deck.onScroll}
          className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain [overflow-anchor:none]"
        >
          {rows.map((row) =>
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

          {/* Scroll infinito: el centinela se detecta 1,5 pantallas antes de llegar al final.
              Con un filtro activo el "cargar más" es manual (en automático recorrería la ciudad). */}
          <LoadMore
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={loadMore}
            watch={feedPage}
            root={deckRef}
            rootMargin="150% 0px"
            auto={cat === null}
            className="h-24 !text-white/60"
          />

          {/* tarjeta final (solo cuando ya no quedan páginas) */}
          {!hasMore && (
            <section className="flex h-full snap-start flex-col items-center justify-center gap-3.5 bg-[radial-gradient(120%_80%_at_50%_0%,#1d3b2f_0%,#121311_70%)] p-8 text-center text-[#C7C1B7]">
              <img src="/brand/isotipo-white.svg" alt="" className="h-[52px] opacity-90" />
              <h2 className="text-[26px] font-light text-[#F3EFE8]">
                {rows.length === 0 ? <>Nada en <span className="font-medium">{cat}</span> por ahora</> : <>Viste todo <span className="font-medium">cerca de ti</span></>}
              </h2>
              <p className="max-w-[260px] text-[15px]">¿Aún no te decides? Te damos 3 opciones con su porqué.</p>
              <Link href="/concierge" className="mt-1.5 inline-flex h-[50px] items-center gap-2 rounded-full bg-goospe-green px-6 text-[15px] font-medium text-on-brand">
                <Sparkles size={17} strokeWidth={1.75} /> Decídeme
              </Link>
              {cat ? (
                <button onClick={() => setCat(null)} className="inline-flex h-11 items-center gap-1.5 px-[18px] text-sm text-white">Ver todas las categorías</button>
              ) : rows.length > 0 ? (
                <button onClick={() => jumpTo(0)} className="inline-flex h-11 items-center gap-1.5 px-[18px] text-sm text-white">
                  <ArrowUp size={15} strokeWidth={1.75} /> Volver al inicio
                </button>
              ) : null}
            </section>
          )}
        </div>

        {/* Encabezado sobre el mazo: logo + controles y, debajo, ciudad + categorías.
            pointer-events-none deja pasar el gesto de scroll; solo los controles lo reciben. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-[linear-gradient(to_bottom,rgba(10,10,9,0.5),rgba(10,10,9,0))] px-4 pb-[22px] pt-[calc(14px+var(--sat))]">
          {/* relative + z-10: el menú de la campana se despliega por encima de los chips. */}
          <div className="relative z-10 flex items-center gap-2.5">
            <Link href="/places" className="pointer-events-auto shrink-0">
              <img src="/brand/logo-white.svg" alt="Goospe" className="h-[22px]" />
            </Link>
            <div className="dark pointer-events-auto ml-auto flex items-center gap-1">
              <Link href="/search" aria-label="Buscar con filtros" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.14] text-white">
                <SlidersHorizontal size={17} strokeWidth={1.75} />
              </Link>
              <ThemeToggle className={OVERLAY_BTN} />
              <Notifications className={OVERLAY_BTN} />
            </div>
          </div>

          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
            {geoSource === 'fallback' && (
              // Ubicación real no disponible → las distancias son desde el centro de la ciudad.
              // Chip accionable: toca para reintentar el permiso.
              <button
                onClick={retryLocation}
                className="pointer-events-auto inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-amber-400/25 px-3 text-[13px] font-medium text-white ring-1 ring-amber-300/40 backdrop-blur"
              >
                <MapPin size={13} strokeWidth={2} className="text-amber-300" /> {location}
                <RefreshCw size={11} strokeWidth={2.5} className="text-amber-200" />
              </button>
            )}
            {/* Chip de ubicación = selector de ciudad (ciudad elegida a mano o "cerca de mí"). */}
            <CitySwitcher variant="dark" label={geoSource === 'fallback' ? 'Elegir ciudad' : location} />
            {categories.length > 0 && [null, ...categories].map((c) => (
              <button
                key={c ?? 'todo'}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`pointer-events-auto inline-flex h-[34px] shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${cat === c ? 'bg-goospe-green text-on-brand' : 'bg-white/[0.12] text-white'}`}
              >
                {c ?? 'Todo'}
              </button>
            ))}
          </div>
        </div>

        {rows.length > 1 && <DeckDots count={rows.length} active={Math.min(active, rows.length - 1)} />}

        {active === 0 && rows.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 top-[calc(116px+var(--sat))] z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[rgba(10,10,9,0.5)] px-3 py-1.5 text-xs text-white backdrop-blur-[6px]">
            <ChevronsUp size={14} strokeWidth={1.75} /> Desliza para ver más
          </div>
        )}
      </main>

      <TabBar tone="dark" />
    </>
  )
}
