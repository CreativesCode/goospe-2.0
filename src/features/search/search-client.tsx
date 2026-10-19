'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Clock, Utensils, Coffee, Martini, Moon, Ticket, X, LayoutGrid, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { LocationNotice } from '@/shared/components/location-notice'
import { PlaceCard } from '@/features/places/PlaceCard'
import { CitySwitcher } from '@/features/city/CitySwitcher'
import { useCityChoice } from '@/features/city/city-store'
import { CITY_EVENT } from '@/lib/city-choice'
import { getPosition, type GeoSource } from '@/lib/geo'
import { track } from '@/lib/track'
import { useFavorites } from '@/hooks/useFavorites'
import { appContainer, eyebrow, pill } from '@/shared/lib/ui'
import {
  clearFilters, cleanQuery, hasFilters, parseSearchState, searchApiQuery, searchHref,
  type SearchState,
} from './search-params'

type Result = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  price_level: number | null
  distance_m: number | null
  photo_url: string | null
  category_emoji: string | null
  category_name: string | null
  rating: number
  open_now: boolean | null
}
type ApiCity = { id: number; slug: string; name: string }

const CATEGORIES: { id: number; label: string; icon: LucideIcon }[] = [
  { id: 1, label: 'Comer', icon: Utensils },
  { id: 2, label: 'Café', icon: Coffee },
  { id: 3, label: 'Beber', icon: Martini },
  { id: 4, label: 'Noche', icon: Moon },
]

const DEBOUNCE_MS = 300
const PRICES = [1, 2, 3, 4]

/** Fila de la lista de categorías de la columna lateral (web). */
const sideItem = (on: boolean) =>
  `flex h-[42px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium transition ${on ? 'bg-tint2 text-ink' : 'text-fg-soft hover:text-fg'}`

/** Precio máximo: control segmentado de 4. Volver a tocar el activo quita el filtro. */
function PriceSegment({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div role="group" aria-label="Precio máximo" className="grid grid-cols-4 overflow-hidden rounded-xl border border-line bg-card">
      {PRICES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          aria-pressed={value === n}
          aria-label={`Hasta ${'$'.repeat(n)}`}
          className={`h-10 border-line text-sm transition ${n < 4 ? 'border-r' : ''} ${value === n ? 'bg-tint2 font-medium text-ink' : 'text-fg-soft hover:text-fg'}`}
        >
          {'$'.repeat(n)}
        </button>
      ))}
    </div>
  )
}

/** Interruptor "Abierto ahora". */
function OpenSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-[14px] border border-line bg-card p-3.5 text-sm text-fg"
    >
      <span className="flex items-center gap-2"><Clock size={15} strokeWidth={1.75} className="text-ink" /> Abierto ahora</span>
      <span className={`relative h-6 w-10 rounded-full transition ${on ? 'bg-goospe-green' : 'bg-line'}`}>
        <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? 'left-[19px]' : 'left-[3px]'}`} />
      </span>
    </button>
  )
}

/**
 * Buscador. La URL es la única fuente de verdad del estado (texto, ciudad, categoría, precio,
 * abierto ahora): los filtros hacen pushState (atrás/adelante los recorre) y el texto, con
 * debounce, replaceState (no llena el historial letra a letra).
 * Layout: columna lateral de filtros sticky en web; en tablet y móvil, chips con scroll
 * horizontal y un botón de filtros. Los resultados son una rejilla (filas en móvil).
 */
export function SearchClient() {
  const params = useSearchParams()
  const state = useMemo(() => parseSearchState(params), [params])
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Texto del input: local para que escribir sea instantáneo; se vuelca a la URL con debounce.
  const [text, setText] = useState(state.q)
  const textRef = useRef(text)
  useEffect(() => { textRef.current = text }, [text])
  const writtenQ = useRef(state.q) // último q que escribió este componente en la URL
  useEffect(() => {
    // La URL cambió desde fuera (atrás/adelante, enlace): el input la sigue.
    if (state.q !== writtenQ.current) { writtenQ.current = state.q; setText(state.q) }
  }, [state.q])

  const navigate = useCallback((next: SearchState, mode: 'push' | 'replace') => {
    writtenQ.current = cleanQuery(next.q)
    const href = searchHref(next)
    // history nativo: Next sincroniza useSearchParams sin pedir nada al servidor.
    if (mode === 'push') window.history.pushState(null, '', href)
    else window.history.replaceState(null, '', href)
  }, [])

  const setFilter = useCallback((patch: Partial<SearchState>) => {
    navigate({ ...stateRef.current, q: textRef.current, ...patch }, 'push')
  }, [navigate])

  useEffect(() => {
    if (cleanQuery(text) === stateRef.current.q) return
    const t = setTimeout(() => navigate({ ...stateRef.current, q: text }, 'replace'), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [text, navigate])

  // ── ciudad y ubicación ──────────────────────────────────────────────────────────────────
  const choice = useCityChoice()
  // Ciudad guardada en el dispositivo y URL sin ciudad → se refleja en la URL (enlace compartible).
  useEffect(() => {
    if (choice && !state.city) navigate({ ...stateRef.current, q: textRef.current, city: choice.slug }, 'replace')
  }, [choice, state.city, navigate])

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')
  const loadPos = useCallback(() => {
    getPosition().then((g) => { setGeoSource(g.source); setPos({ lat: g.lat, lng: g.lng }) })
  }, [])
  useEffect(() => {
    loadPos()
    window.addEventListener(CITY_EVENT, loadPos)
    return () => window.removeEventListener(CITY_EVENT, loadPos)
  }, [loadPos])

  // ── resultados ──────────────────────────────────────────────────────────────────────────
  // Cada respuesta se guarda con la clave de la petición que la produjo: "cargando" es, por
  // definición, que la clave actual todavía no tiene respuesta (sin estados que sincronizar).
  const [outcome, setOutcome] = useState<{ key: string; results: Result[]; city: ApiCity | null; failed: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Con ciudad no hace falta la ubicación; sin ciudad se espera a tenerla.
  const ready = state.city !== null || pos !== null
  const apiQuery = useMemo(() => searchApiQuery(state, pos), [state, pos])
  const requestKey = `${attempt}|${apiQuery}`

  useEffect(() => {
    if (!ready) return
    const ctrl = new AbortController()
    fetch(`/api/search?${apiQuery}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`search ${res.status}`))))
      .then((data: { results?: Result[]; city?: ApiCity | null }) => {
        setOutcome({ key: requestKey, results: data.results ?? [], city: data.city ?? null, failed: false })
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return // llegó una búsqueda más nueva
        // Red caída o respuesta inválida: error con reintento en vez de colgar el indicador.
        setOutcome({ key: requestKey, results: [], city: null, failed: true })
      })
    return () => ctrl.abort()
  }, [apiQuery, ready, requestKey])

  const loading = outcome?.key !== requestKey
  const status: 'loading' | 'ready' | 'error' = loading ? 'loading' : outcome?.failed ? 'error' : 'ready'
  // Mientras llega la búsqueda nueva se siguen mostrando (atenuados) los resultados anteriores.
  const results = outcome?.results ?? []
  const apiCity = outcome?.city?.slug === state.city ? outcome.city : null
  const filtersOn = hasFilters(state)
  // Ciudad que se muestra en el chip: la de la URL (resuelta por la API); si no hay, la guardada.
  const shownCity = state.city ? (apiCity ?? (choice?.slug === state.city ? choice : null)) : null
  const unknownCity = state.city !== null && status === 'ready' && apiCity === null
  const where = shownCity ? `en ${shownCity.name}` : unknownCity ? 'en todas las ciudades' : 'cerca de ti'

  // Corazón de las tarjetas: una sola carga de guardados para toda la rejilla.
  const { isSaved, toggle } = useFavorites()
  const onToggleSave = (id: string) => { track(toggle(id) ? 'save' : 'unsave', { placeId: id }) }
  // Panel de filtros de tablet/móvil (precio + abierto ahora); en web van en la columna lateral.
  const [showFilters, setShowFilters] = useState(false)
  const clearAll = () => { setText(''); navigate(clearFilters(state), 'push') }
  const extraFilters = (state.price != null ? 1 : 0) + (state.open ? 1 : 0)

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      {/* min-h: el pie no salta mientras cambian los resultados. */}
      <div className={`${appContainer} grid min-h-[70vh] items-start gap-8 pb-12 pt-[18px] md:pt-7 lg:grid-cols-[240px_minmax(0,1fr)]`}>
        {/* filtros (web) */}
        <aside className="sticky top-[88px] hidden flex-col gap-[26px] lg:flex">
          <div>
            <div className={eyebrow}>Categoría</div>
            <div className="mt-2.5 flex flex-col gap-0.5">
              <button onClick={() => setFilter({ cat: null })} aria-pressed={state.cat === null} className={sideItem(state.cat === null)}>
                <LayoutGrid size={17} strokeWidth={1.75} /> Todo
              </button>
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setFilter({ cat: state.cat === id ? null : id })} aria-pressed={state.cat === id} className={sideItem(state.cat === id)}>
                  <Icon size={17} strokeWidth={1.75} /> {label}
                </button>
              ))}
              {/* "Eventos" no es un filtro de lugares (ningún lugar lleva esa categoría): enlaza a la cartelera. */}
              <Link href="/events" className={sideItem(false)}>
                <Ticket size={17} strokeWidth={1.75} /> Eventos
              </Link>
            </div>
          </div>
          <div>
            <div className={eyebrow}>Precio máximo</div>
            {/* Es un TOPE ("hasta"), y con filtro activo no entran los lugares sin precio. */}
            <div className="mt-2.5"><PriceSegment value={state.price} onChange={(price) => setFilter({ price })} /></div>
          </div>
          <OpenSwitch on={state.open} onChange={(open) => setFilter({ open })} />
          {filtersOn && (
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-fg">
              <X size={14} strokeWidth={2} /> Limpiar filtros
            </button>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex gap-2.5">
            <div className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-card px-[18px] transition focus-within:border-goospe-green focus-within:shadow-[0_0_0_4px_rgba(45,193,134,0.12)]">
              <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { navigate({ ...state, q: text }, 'replace'); e.currentTarget.blur() } }}
                placeholder="Busca por nombre, tipo o etiqueta…"
                type="search"
                aria-label="Buscar lugar"
                enterKeyHint="search"
                autoComplete="off"
                maxLength={80}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
              />
            </div>
            <CitySwitcher
              current={state.city && !unknownCity ? (shownCity ?? { id: -1, name: '…' }) : null}
              label="Cerca de mí"
              className="!h-[52px] shrink-0 !max-w-[38vw]"
              onChange={(c) => setFilter({ city: c?.slug ?? null })}
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-label={extraFilters ? `Filtros (${extraFilters} activos)` : 'Filtros'}
              className={`relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border transition lg:hidden ${showFilters || extraFilters ? 'border-goospe-green bg-tint2 text-ink' : 'border-line bg-card text-fg'}`}
            >
              <SlidersHorizontal size={18} strokeWidth={1.75} />
            </button>
          </div>

          {/* categorías como chips (tablet y móvil) */}
          <div className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6 lg:hidden">
            <button onClick={() => setFilter({ cat: null })} aria-pressed={state.cat === null} className={pill(state.cat === null)}>
              <LayoutGrid size={15} strokeWidth={1.75} /> Todo
            </button>
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setFilter({ cat: state.cat === id ? null : id })} aria-pressed={state.cat === id} className={pill(state.cat === id)}>
                <Icon size={15} strokeWidth={1.75} /> {label}
              </button>
            ))}
            <Link href="/events" className={pill(false)}>
              <Ticket size={15} strokeWidth={1.75} /> Eventos
            </Link>
          </div>

          {showFilters && (
            <div className="mt-3.5 grid gap-3 rounded-[20px] border border-line bg-card p-4 min-[560px]:grid-cols-2 lg:hidden">
              <div>
                <div className={eyebrow}>Precio máximo</div>
                <div className="mt-2.5"><PriceSegment value={state.price} onChange={(price) => setFilter({ price })} /></div>
              </div>
              <div className="self-end"><OpenSwitch on={state.open} onChange={(open) => setFilter({ open })} /></div>
            </div>
          )}

          {!state.city && <LocationNotice source={geoSource} onRetry={loadPos} className="mt-5" />}
          {unknownCity && (
            <p role="status" className="mt-5 rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm text-fg-soft">
              No encontramos esa ciudad, así que buscamos en todas. Elige una arriba para ver lo que hay cerca.
            </p>
          )}

          {/* Línea de estado de alto fijo: anuncia el resultado sin mover la grilla. */}
          <div className="mb-3.5 mt-[22px] flex h-5 items-center justify-between gap-3 text-sm">
            <p role="status" aria-live="polite">
              {loading ? 'Buscando…' : status === 'ready' && results.length > 0 ? (
                <><b className="font-medium text-fg">{results.length}{results.length === 60 ? '+' : ''} {results.length === 1 ? 'lugar' : 'lugares'}</b> {where}</>
              ) : ''}
            </p>
            {filtersOn && (
              <button onClick={clearAll} className="inline-flex items-center gap-1 text-muted transition hover:text-fg lg:hidden">
                <X size={14} strokeWidth={2} /> Limpiar
              </button>
            )}
          </div>

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-fg-soft">No pudimos completar la búsqueda. Revisa tu conexión e intenta de nuevo.</p>
              <button onClick={() => setAttempt((n) => n + 1)} className="h-11 rounded-full bg-goospe-green px-5 text-sm font-medium text-on-brand transition hover:brightness-105">
                Reintentar
              </button>
            </div>
          )}

          {status === 'ready' && results.length === 0 && (
            filtersOn ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-fg-soft">Sin resultados {where} con estos filtros.</p>
                <button onClick={clearAll} className="h-11 rounded-full border border-line bg-card px-5 text-sm font-medium text-fg transition hover:border-goospe-green/50">
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <p className="py-16 text-center text-muted">Aún no hay lugares publicados {where}.</p>
            )
          )}

          {/* Primera carga: esqueleto con la forma de la grilla. En las siguientes se dejan los
              resultados anteriores atenuados hasta que llegan los nuevos (sin parpadeo ni salto). */}
          {loading && results.length === 0 ? (
            <div aria-hidden className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="overflow-hidden rounded-[20px] border border-line bg-card">
                  <div className="h-24 animate-pulse bg-ph md:h-[168px]" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-line/50" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-line/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {/* móvil: filas con la foto a la izquierda */}
              <div className="flex flex-col gap-2.5 md:hidden">
                {results.map((p) => <PlaceCard key={p.id} place={p} layout="row" />)}
              </div>
              {/* tablet y web: rejilla de tarjetas */}
              <div className="hidden gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))] md:grid">
                {results.map((p) => (
                  <PlaceCard key={p.id} place={p} saved={isSaved(p.id)} onToggleSave={() => onToggleSave(p.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
