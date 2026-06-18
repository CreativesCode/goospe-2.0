'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart, Compass, Share2, Star, MapPin } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { track } from '@/lib/track'
import { directionsHref, fmtDist, type FeedController, type FeedItem } from './use-feed'

/** Miniatura de foto o gradiente de marca (fallback sin foto). */
function Thumb({ p, className }: { p: FeedItem; className?: string }) {
  if (p.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo_url} alt={p.name} className={`object-cover ${className ?? ''}`} />
  }
  const Cat = categoryIcon(p.category_emoji)
  return (
    <div className={`flex items-center justify-center bg-goospe-gradient text-white ${className ?? ''}`}>
      <Cat size={28} strokeWidth={1.5} />
    </div>
  )
}

/**
 * Feed tablet — maestro / detalle (claro). Hero grande del lugar seleccionado +
 * columna "A continuación" navegable. Sigue el mock `01 · Feed — maestro / detalle`.
 */
export function FeedTablet({ feed }: { feed: FeedController }) {
  const { items, isSaved, onSave, onDismiss, onShare, onDirections, location, whenLabel } = feed
  const [selected, setSelected] = useState(0)
  const seen = useRef<Set<string>>(new Set())

  const hero = items[selected]
  const next = items.filter((_, i) => i !== selected).slice(0, 6)

  // Mantiene la selección válida si la lista cambia (p. ej. tras descartar).
  useEffect(() => { if (selected >= items.length) setSelected(0) }, [items.length, selected])

  // view_card al cambiar de hero.
  useEffect(() => {
    if (!hero || seen.current.has(hero.id)) return
    seen.current.add(hero.id)
    track('view_card', { placeId: hero.id })
  }, [hero])

  if (!hero) {
    return (
      <main className="flex min-h-screen flex-col bg-surface">
        <AppNav />
        <div className="flex flex-1 items-center justify-center px-6 py-20 text-center text-muted">
          <p>No hay lugares cerca de ti por ahora.</p>
        </div>
      </main>
    )
  }

  const HeroCat = categoryIcon(hero.category_emoji)

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
      <AppNav />

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4">
        {/* encabezado */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-light tracking-tight text-fg">Para ti</h1>
            {whenLabel && <span className="text-sm text-muted">{whenLabel}</span>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-fg">
            <MapPin size={15} strokeWidth={2} className="text-goospe-green" /> {location}
          </span>
        </div>

        {/* maestro / detalle */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_320px] gap-5">
          {/* hero */}
          <Link
            href={`/places/${hero.slug}`}
            className="group relative overflow-hidden rounded-3xl shadow-lg"
          >
            <Thumb p={hero} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />
            <div className="absolute inset-x-5 top-5 flex items-center justify-between">
              {hero.category_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur">
                  <HeroCat size={14} strokeWidth={2} /> {hero.category_name}
                </span>
              )}
              {hero.boosted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/40">
                  Destacado
                </span>
              )}
            </div>
            <div className="text-shadow-photo absolute inset-x-7 bottom-7 text-white">
              <h2 className="text-4xl font-medium leading-tight tracking-tight drop-shadow">{hero.name}</h2>
              {hero.vibe_line && <p className="mt-2 text-xl font-medium text-goospe-green-light drop-shadow">{hero.vibe_line}</p>}
              <div className="mt-3 flex items-center gap-3 text-sm text-white/85">
                {hero.rating > 0 && <span className="inline-flex items-center gap-1"><Star size={15} strokeWidth={1.75} fill="currentColor" /> {Number(hero.rating).toFixed(1)}</span>}
                {hero.price_level ? <><span className="opacity-50">·</span><span>{'$'.repeat(hero.price_level)}</span></> : null}
                <span className="opacity-50">·</span><span>{fmtDist(hero.distance_m)}</span>
              </div>
            </div>
          </Link>

          {/* columna lateral */}
          <div className="flex min-h-0 flex-col gap-4">
            {/* acciones del hero */}
            <div className="flex gap-3 rounded-3xl border border-line bg-card p-4 shadow-sm">
              <button onClick={() => onSave(hero)} className="flex flex-1 flex-col items-center gap-2">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full transition ${isSaved(hero.id) ? 'bg-goospe-green text-white' : 'bg-surface text-fg-soft'}`}>
                  <Heart size={24} strokeWidth={1.75} fill={isSaved(hero.id) ? 'currentColor' : 'none'} />
                </span>
                <span className={`text-xs font-medium ${isSaved(hero.id) ? 'text-goospe-green-dark' : 'text-fg-soft'}`}>Guardar</span>
              </button>
              <a
                href={directionsHref(hero.lat, hero.lng)}
                target="_blank" rel="noreferrer"
                onClick={() => onDirections(hero)}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-fg-soft"><Compass size={24} strokeWidth={1.7} /></span>
                <span className="text-xs text-fg-soft">Cómo llego</span>
              </a>
              <button onClick={() => onShare(hero)} className="flex flex-1 flex-col items-center gap-2">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-fg-soft"><Share2 size={22} strokeWidth={1.7} /></span>
                <span className="text-xs text-fg-soft">Compartir</span>
              </button>
            </div>

            {/* a continuación */}
            <div className="text-xs font-medium uppercase tracking-wider text-muted">A continuación</div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {next.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(items.indexOf(p))}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition hover:border-goospe-green/40 hover:shadow-sm"
                >
                  <Thumb p={p} className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-fg">{p.name}</div>
                    {p.vibe_line && <div className="truncate text-sm text-goospe-green">{p.vibe_line}</div>}
                    <div className="mt-0.5 text-xs text-muted">
                      {p.price_level ? `${'$'.repeat(p.price_level)} · ` : ''}{fmtDist(p.distance_m)}
                    </div>
                  </div>
                </button>
              ))}
              {next.length > 1 && (
                <button
                  onClick={() => onDismiss(hero.id)}
                  className="mt-1 self-start text-xs text-muted underline-offset-2 transition hover:text-fg hover:underline"
                >
                  No me interesa este
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
