'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart, Star, Sparkles } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { LocationNotice } from '@/shared/components/location-notice'
import { track } from '@/lib/track'
import { fmtDist, type FeedController, type FeedItem } from './use-feed'

function Thumb({ p, className, priority }: { p: FeedItem; className?: string; priority?: boolean }) {
  const [imgError, setImgError] = useState(false)
  if (p.photo_url && !imgError) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={p.photo_url}
        alt={p.name}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => setImgError(true)}
        className={`object-cover ${className ?? ''}`}
      />
    )
  }
  const Cat = categoryIcon(p.category_emoji)
  return (
    <div className={`flex items-center justify-center bg-goospe-gradient text-white ${className ?? ''}`}>
      <Cat size={32} strokeWidth={1.5} />
    </div>
  )
}

/**
 * Card pequeña del bento (lugar no destacado). Memoizada: con `onSave` estable (del feed)
 * y `p` referencialmente estable, solo se re-renderiza la card afectada al guardar.
 */
const PlaceCard = memo(function PlaceCard({ p, saved, onSave }: { p: FeedItem; saved: boolean; onSave: (p: FeedItem) => void }) {
  return (
    <Link
      href={`/places/${p.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-line bg-card transition hover:shadow-md"
    >
      <Thumb p={p} className="h-32 w-full" />
      <button
        onClick={(e) => { e.preventDefault(); onSave(p) }}
        aria-pressed={saved}
        aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition ${saved ? 'bg-goospe-green text-white' : 'bg-black/30 text-white opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}`}
      >
        <Heart size={16} strokeWidth={1.9} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="space-y-0.5 p-4">
        <div className="truncate font-medium text-fg">{p.name}</div>
        {p.vibe_line && <div className="line-clamp-2 text-sm text-goospe-green">{p.vibe_line}</div>}
        <div className="pt-1 text-xs text-muted">
          {p.price_level ? `${'$'.repeat(p.price_level)} · ` : ''}{fmtDist(p.distance_m)}
        </div>
      </div>
    </Link>
  )
})

/**
 * Feed web — tablero de descubrimiento (claro, bento). Destacado grande + grid de
 * cards, con chips de filtro por categoría. Sigue el mock `02 · Feed — tablero`.
 */
export function FeedDesktop({ feed }: { feed: FeedController }) {
  const { items, isSaved, onSave, location, whenLabel, geoSource, retryLocation } = feed
  const [cat, setCat] = useState<string | null>(null)
  const seen = useRef<Set<string>>(new Set())

  // Categorías presentes en los datos → chips "Todo" + categorías.
  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((p) => { if (p.category_name) set.add(p.category_name) })
    return [...set].slice(0, 5)
  }, [items])

  const filtered = useMemo(
    () => (cat ? items.filter((p) => p.category_name === cat) : items),
    [items, cat]
  )

  // Destacado: el primer boosted, o el primero de la lista filtrada.
  const featured = filtered.find((p) => p.boosted) ?? filtered[0]
  const rest = filtered.filter((p) => p.id !== featured?.id)

  useEffect(() => {
    if (!featured || seen.current.has(featured.id)) return
    seen.current.add(featured.id)
    track('view_card', { placeId: featured.id })
  }, [featured])

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <LocationNotice source={geoSource} onRetry={retryLocation} className="mb-5" />
        {/* encabezado + filtros */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted">{whenLabel} · {location}</div>
            <h1 className="mt-1 text-4xl font-light tracking-tight text-fg">
              Para <span className="font-medium">ti</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setCat(null)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${cat === null ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}
            >
              Todo
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(cat === c ? null : c)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${cat === c ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {!featured ? (
          <p className="py-20 text-center text-muted">No hay lugares en esta categoría.</p>
        ) : (
          <div className="grid items-stretch gap-5 [grid-auto-rows:minmax(208px,auto)] [grid-template-columns:2fr_1fr_1fr]">
            {/* destacado */}
            <Link
              href={`/places/${featured.slug}`}
              className="group relative row-span-2 overflow-hidden rounded-3xl shadow-lg"
            >
              <Thumb p={featured} priority className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
              <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/40">
                <Sparkles size={13} strokeWidth={2} /> Destacado
              </span>
              <div className="text-shadow-photo absolute inset-x-6 bottom-6 text-white">
                <h2 className="text-3xl font-medium leading-tight tracking-tight drop-shadow">{featured.name}</h2>
                {featured.vibe_line && <p className="mt-1.5 text-lg text-goospe-green-light drop-shadow">{featured.vibe_line}</p>}
                <div className="mt-2.5 flex items-center gap-2 text-sm text-white/85">
                  {featured.rating > 0 && <span className="inline-flex items-center gap-1"><Star size={14} strokeWidth={1.75} fill="currentColor" /> {Number(featured.rating).toFixed(1)}</span>}
                  {featured.price_level ? <><span className="opacity-50">·</span><span>{'$'.repeat(featured.price_level)}</span></> : null}
                  <span className="opacity-50">·</span><span>{fmtDist(featured.distance_m)}</span>
                </div>
              </div>
            </Link>

            {/* resto */}
            {rest.map((p) => (
              <PlaceCard key={p.id} p={p} saved={isSaved(p.id)} onSave={onSave} />
            ))}
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
