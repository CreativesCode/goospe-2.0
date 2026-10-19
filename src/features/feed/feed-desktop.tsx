'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Sparkles, Ban, Share2, Compass, ChevronUp, ChevronDown, Mouse, LayoutGrid } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { appContainer, eyebrow, pageTitle, pill } from '@/shared/lib/ui'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { LocationNotice } from '@/shared/components/location-notice'
import { PhotoImg } from '@/shared/components/photo-img'
import { OpenNowBadge } from '@/features/places/OpenNowBadge'
import { PlaceCard } from '@/features/places/PlaceCard'
import { CitySwitcher } from '@/features/city/CitySwitcher'
import { DotList } from './dot-list'
import { LoadMore } from './load-more'
import { buildWhy } from './feed-why'
import { useCardImpressions } from './impressions'
import { useDeck } from './use-deck'
import { directionsHref, fmtDistDrive, type FeedController, type FeedItem } from './use-feed'
import { useScrollRestore } from './use-scroll-restore'

const GLASS_BTN = 'inline-flex h-[52px] items-center gap-2 rounded-full bg-white/[0.14] px-[22px] font-medium text-white backdrop-blur-[8px] transition hover:bg-white/20'
const ARROW_BTN = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.16] text-white backdrop-blur-[8px] transition hover:bg-white/25 disabled:opacity-40'
const CHIP_DARK = 'inline-flex items-center gap-1.5 rounded-full bg-[rgba(10,10,9,0.45)] px-3 py-1.5 leading-none text-white'

/**
 * Una tarjeta del mazo web. Memoizada: con `saved` (boolean) y los callbacks estables del
 * feed solo se re-renderiza la tarjeta afectada al guardar o descartar.
 */
const DeckCard = memo(function DeckCard({
  p,
  position,
  saved,
  priority,
  onSave,
  onShare,
  onDismiss,
  onDirections,
}: {
  p: FeedItem
  /** "3 de 40" */
  position: string
  saved: boolean
  priority?: boolean
  onSave: (p: FeedItem) => void
  onShare: (p: FeedItem) => void
  onDismiss: (id: string) => void
  onDirections: (p: FeedItem) => void
}) {
  const Cat = categoryIcon(p.category_emoji)
  return (
    <article data-track-id={p.id} data-kind="place" className="relative h-full snap-start snap-always overflow-hidden">
      <PhotoImg
        src={p.photo_url}
        alt={p.name}
        priority={priority}
        tone="deep"
        className="absolute inset-0 h-full w-full object-cover pb-40 [&:is(img)]:pb-0"
        fallback={<Cat size={110} strokeWidth={1.1} />}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,9,0.9),rgba(10,10,9,0)_58%,rgba(10,10,9,0.3))]" />

      <div className="absolute left-6 top-[22px] flex flex-wrap gap-2 text-xs font-medium">
        {p.category_name && <span className={CHIP_DARK}><Cat size={13} strokeWidth={2} /> {p.category_name}</span>}
        <OpenNowBadge hours={p.hours} timezone={p.timezone} className="!px-3 !py-1.5" />
        {p.boosted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-3 py-1.5 leading-none text-on-brand">
            <Sparkles size={13} strokeWidth={2} /> Destacado
          </span>
        )}
      </div>
      <div className={`${CHIP_DARK} absolute right-[22px] top-[22px] text-xs`}>{position}</div>

      <div className="text-shadow-photo absolute bottom-[30px] left-8 right-24 text-white">
        <DotList className="flex flex-wrap items-center gap-2 text-[15px] text-white/[0.82]">
          <span>{fmtDistDrive(p.distance_m)}</span>
          {p.rating > 0 ? <span>★ {Number(p.rating).toFixed(1)}</span> : null}
          {p.price_level ? <span>{'$'.repeat(p.price_level)}</span> : null}
        </DotList>
        <Link href={`/places/${p.slug}`} className="mt-2 block">
          <h2 className="text-[clamp(36px,4vw,56px)] font-medium leading-none tracking-[-0.03em]">{p.name}</h2>
        </Link>
        {p.vibe_line && <p className="mt-2 text-xl text-goospe-green-light">{p.vibe_line}</p>}
        {p.description && <p className="mt-2.5 line-clamp-2 max-w-[520px] text-[15px] leading-normal text-white/85">{p.description}</p>}
        <div className="mt-[22px] flex flex-wrap gap-2.5 text-[15px] [text-shadow:none]">
          <button onClick={() => onDismiss(p.id)} aria-label="Paso: descartar este lugar" className={GLASS_BTN}>
            <Ban size={17} strokeWidth={1.75} /> Paso
          </button>
          <button onClick={() => onShare(p)} className={GLASS_BTN}>
            <Share2 size={17} strokeWidth={1.75} /> Compartir
          </button>
          <a
            href={directionsHref(p.lat, p.lng)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onDirections(p)}
            className="inline-flex h-[52px] items-center gap-2 rounded-full bg-white px-[22px] font-medium text-[#1C1C1A] transition hover:bg-white/90"
          >
            <Compass size={17} strokeWidth={1.75} /> Cómo llego
          </a>
          <button
            onClick={() => onSave(p)}
            aria-pressed={saved}
            className={`inline-flex h-[52px] items-center gap-2 rounded-full px-6 font-medium transition ${
              saved ? 'bg-white/[0.14] text-goospe-green-light backdrop-blur-[8px]' : 'bg-goospe-green text-on-brand hover:brightness-105'
            }`}
          >
            <Heart size={17} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </article>
  )
})

/** Tarjeta oscura del panel lateral al llegar al final del mazo. */
function DeckDone({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="rounded-[20px] bg-deep p-5 text-deep-soft">
      <div className="text-[17px] font-medium text-[#F3EFE8]">Viste todo cerca de ti</div>
      <p className="mb-3.5 mt-1 text-sm">¿Aún no te decides? Te damos 3 opciones.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/concierge" className="inline-flex h-[42px] items-center gap-[7px] rounded-full bg-goospe-green px-[18px] text-sm font-medium text-on-brand">
          <Sparkles size={15} strokeWidth={1.75} /> Decídeme
        </Link>
        <button onClick={onRestart} className="h-[42px] rounded-full bg-white/10 px-4 text-sm text-white transition hover:bg-white/20">Volver al inicio</button>
      </div>
    </div>
  )
}

/**
 * Feed web y tablet — mazo de decisión (640 px; 560 en tablet) con scroll vertical y snap, y
 * un panel lateral con el porqué del lugar activo, el progreso y "lo que sigue". En tablet el
 * panel se apila debajo del mazo. Rueda, botones ↑/↓ y flechas del teclado avanzan el mazo.
 */
export function FeedDesktop({ feed }: { feed: FeedController }) {
  const { items, isSaved, onSave, onDismiss, onShare, onDirections, location, whenLabel, geoSource, retryLocation, hasMore, loadingMore, loadMore, feedPage, settled } = feed
  const [cat, setCat] = useState<string | null>(null)
  const deck = useDeck()
  const { ref: deckRef, jumpTo, step } = deck

  // Categorías presentes en los datos → chips "Todo" + categorías (con su icono).
  const categories = useMemo(() => {
    const seen = new Map<string, string | null>()
    items.forEach((p) => { if (p.category_name && !seen.has(p.category_name)) seen.set(p.category_name, p.category_emoji) })
    return [...seen].slice(0, 5).map(([name, emoji]) => ({ name, icon: categoryIcon(emoji) }))
  }, [items])

  const filtered = useMemo(() => (cat ? items.filter((p) => p.category_name === cat) : items), [items, cat])
  const total = filtered.length
  const active = Math.min(deck.active, Math.max(0, total - 1))
  const current = filtered[active]

  // Otra categoría = otro mazo: vuelve a la primera tarjeta.
  useEffect(() => { jumpTo(0, true) }, [cat, jumpTo])

  // view_card: cada tarjeta que permanece visible ≥2 s cuenta una vez (ver impressions.ts).
  useCardImpressions(deckRef, filtered)

  // Volver a la misma tarjeta tras visitar una ficha; se restaura con la lista definitiva.
  useScrollRestore('desktop', settled && items.length > 0, { target: deckRef })

  const countLabel = `${total}${hasMore ? '+' : ''}`

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className={`${appContainer} flex-1 pb-12 pt-7`}>
        <LocationNotice source={geoSource} onRetry={retryLocation} className="mb-5" />

        {/* encabezado + filtros */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-fg-soft">
              <CitySwitcher variant="inline" label={location} />
              {whenLabel && <span className="text-muted">· {whenLabel}</span>}
            </div>
            <h1 className={`${pageTitle} mt-1.5`}>Para <span className="font-medium">ti</span></h1>
          </div>
          <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-0.5">
            <button onClick={() => setCat(null)} aria-pressed={cat === null} className={pill(cat === null)}>
              <LayoutGrid size={15} strokeWidth={1.75} /> Todo
            </button>
            {categories.map(({ name, icon: Icon }) => (
              <button key={name} onClick={() => setCat(cat === name ? null : name)} aria-pressed={cat === name} className={pill(cat === name)}>
                <Icon size={15} strokeWidth={1.75} /> {name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* mazo */}
          <div className="relative h-[560px] overflow-hidden rounded-[32px] bg-[#121311] lg:h-[640px]">
            <div
              // key: al cambiar la tanda SSR por la lista real el contenedor se monta de nuevo. Sin esto
              // el navegador re-ajusta el snap siguiendo a la tarjeta que estaba en pantalla, que en la
              // lista real puede haber quedado en la posición 30.
              key={settled ? 'live' : 'seed'}
              ref={deckRef}
              onScroll={deck.onScroll}
              tabIndex={0}
              aria-label="Lugares sugeridos"
              className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [overflow-anchor:none]"
            >
              {filtered.map((p, i) => (
                <DeckCard
                  key={p.id}
                  p={p}
                  position={`${i + 1} de ${countLabel}`}
                  saved={isSaved(p.id)}
                  priority={i === 0}
                  onSave={onSave}
                  onShare={onShare}
                  onDismiss={onDismiss}
                  onDirections={onDirections}
                />
              ))}
              {total === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-[#C7C1B7]">
                  <p>No hay lugares en esta categoría.</p>
                  {cat && <button onClick={() => setCat(null)} className="h-[42px] rounded-full bg-white/10 px-4 text-sm text-white">Ver todo</button>}
                </div>
              )}
              {/* Con un filtro activo el "cargar más" es manual: en automático recorrería toda
                  la ciudad buscando esa categoría. */}
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
            </div>
            {total > 1 && (
              <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-2">
                <button onClick={() => step(-1)} disabled={active === 0} aria-label="Anterior" className={ARROW_BTN}><ChevronUp size={20} strokeWidth={1.75} /></button>
                <button onClick={() => step(1)} disabled={active >= total - 1} aria-label="Siguiente" className={ARROW_BTN}><ChevronDown size={20} strokeWidth={1.75} /></button>
              </div>
            )}
          </div>

          {/* panel lateral */}
          {current && (
            <aside className="flex min-w-0 flex-col gap-3">
              <div className="rounded-[20px] bg-tint px-5 py-[18px]">
                <div className="flex items-center gap-[7px] text-[13px] font-medium text-ink">
                  <Sparkles size={14} strokeWidth={1.75} className="shrink-0" /> Por qué te sugerimos {current.name}
                </div>
                <p className="mt-1.5 text-sm leading-normal text-fg-soft">{buildWhy(current)}</p>
              </div>

              <div className="flex items-center gap-3 text-[13px] text-muted">
                <span className="shrink-0">{active + 1} de {countLabel}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-goospe-green transition-[width] duration-300" style={{ width: `${Math.round(((active + 1) / total) * 100)}%` }} />
                </div>
                <span className="flex shrink-0 items-center gap-1"><Mouse size={14} strokeWidth={1.75} /> rueda o ↑ ↓</span>
              </div>

              {active < total - 1 && <div className={`${eyebrow} mt-1.5`}>Lo que sigue</div>}
              {filtered.slice(active + 1, active + 6).map((p, k) => (
                <div key={p.id} className="h-24">
                  <PlaceCard place={p} layout="row" onOpen={() => jumpTo(active + 1 + k)} />
                </div>
              ))}

              {active >= total - 1 && !hasMore && <DeckDone onRestart={() => jumpTo(0)} />}
            </aside>
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
