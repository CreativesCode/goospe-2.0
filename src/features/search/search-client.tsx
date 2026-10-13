'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Clock, Utensils, Coffee, Martini, Moon, Ticket, X, type LucideIcon } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { LocationNotice } from '@/shared/components/location-notice'
import { PlaceCard } from '@/features/places/PlaceCard'
import { CitySwitcher } from '@/features/city/CitySwitcher'
import { useCityChoice } from '@/features/city/city-store'
import { CITY_EVENT } from '@/lib/city-choice'
import { getPosition, type GeoSource } from '@/lib/geo'
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
const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${on ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`

/**
 * Buscador. La URL es la única fuente de verdad del estado (texto, ciudad, categoría, precio,
 * abierto ahora): los filtros hacen pushState (atrás/adelante los recorre) y el texto, con
 * debounce, replaceState (no llena el historial letra a letra).
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

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="sticky top-[57px] z-20 space-y-3 border-b border-line bg-surface/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
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
                className="w-full rounded-full border border-line bg-card py-2.5 pl-11 pr-5 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
              />
            </div>
            <CitySwitcher
              current={state.city && !unknownCity ? (shownCity ?? { id: -1, name: '…' }) : null}
              label="Cerca de mí"
              className="shrink-0 !max-w-[40vw] !py-2.5"
              onChange={(c) => setFilter({ city: c?.slug ?? null })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setFilter({ cat: state.cat === id ? null : id })} aria-pressed={state.cat === id} className={chip(state.cat === id)}>
                <Icon size={15} strokeWidth={1.75} /> {label}
              </button>
            ))}
            {/* "Eventos" no es un filtro de lugares (ningún lugar lleva esa categoría): enlaza a la cartelera. */}
            <Link href="/events" className={chip(false)}>
              <Ticket size={15} strokeWidth={1.75} /> Eventos
            </Link>
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              aria-label="Precio máximo"
              value={state.price ?? ''}
              onChange={(e) => setFilter({ price: e.target.value ? Number(e.target.value) : null })}
              className="select-chevron rounded-full border border-line bg-card px-3 py-1.5 text-sm text-fg-soft outline-none focus:border-goospe-green"
            >
              {/* Es un TOPE ("hasta"), y con filtro activo no entran los lugares sin precio. */}
              <option value="">Cualquier precio</option>
              <option value="1">Hasta $</option>
              <option value="2">Hasta $$</option>
              <option value="3">Hasta $$$</option>
              <option value="4">Hasta $$$$</option>
            </select>
            <button onClick={() => setFilter({ open: !state.open })} aria-pressed={state.open} className={chip(state.open)}>
              <Clock size={15} strokeWidth={1.75} /> Abierto ahora
            </button>
            {filtersOn && (
              <button
                onClick={() => { setText(''); navigate(clearFilters(state), 'push') }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-muted transition hover:text-fg"
              >
                <X size={14} strokeWidth={2} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* min-h: el pie no salta mientras cambian los resultados. */}
      <div className="mx-auto min-h-[70vh] w-full max-w-5xl px-5 py-8">
        {!state.city && <LocationNotice source={geoSource} onRetry={loadPos} className="mb-6" />}
        {unknownCity && (
          <p role="status" className="mb-6 rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-fg-soft">
            No encontramos esa ciudad, así que buscamos en todas. Elige una arriba para ver lo que hay cerca.
          </p>
        )}

        {/* Línea de estado de alto fijo: anuncia el resultado sin mover la grilla. */}
        <p role="status" aria-live="polite" className="mb-4 h-5 text-sm text-muted">
          {loading ? 'Buscando…' : status === 'ready' && results.length > 0
            ? `${results.length}${results.length === 60 ? '+' : ''} ${results.length === 1 ? 'lugar' : 'lugares'} ${where}`
            : ''}
        </p>

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-fg-soft">No pudimos completar la búsqueda. Revisa tu conexión e intenta de nuevo.</p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-full bg-goospe-green px-5 py-2 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
            >
              Reintentar
            </button>
          </div>
        )}

        {status === 'ready' && results.length === 0 && (
          filtersOn ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-fg-soft">Sin resultados {where} con estos filtros.</p>
              <button
                onClick={() => { setText(''); navigate(clearFilters(state), 'push') }}
                className="rounded-full border border-line bg-card px-5 py-2 text-sm font-medium text-fg-soft transition hover:text-fg"
              >
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
          <div aria-hidden className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="aspect-[4/3] animate-pulse bg-line/50" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-line/50" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-line/40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            aria-busy={loading}
            className={`grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-50' : ''}`}
          >
            {results.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
