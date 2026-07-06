'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, Clock, Utensils, Coffee, Martini, Moon, Ticket, type LucideIcon } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { Loader } from '@/shared/components/loader'
import { LocationNotice } from '@/shared/components/location-notice'
import { PlaceCard } from '@/features/places/PlaceCard'
import { getPosition, type GeoSource } from '@/lib/geo'

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

const CATEGORIES: { id: number; label: string; icon: LucideIcon }[] = [
  { id: 1, label: 'Comer', icon: Utensils },
  { id: 2, label: 'Café', icon: Coffee },
  { id: 3, label: 'Beber', icon: Martini },
  { id: 4, label: 'Noche', icon: Moon },
  { id: 5, label: 'Eventos', icon: Ticket },
]
export default function BuscarPage() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [openNow, setOpenNow] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')

  // Resuelve ubicación (reutilizable como reintento si el usuario activa el permiso).
  const loadPos = useCallback(() => {
    getPosition().then((g) => { setGeoSource(g.source); setPos({ lat: g.lat, lng: g.lng }) })
  }, [])
  useEffect(() => { loadPos() }, [loadPos])

  const search = useCallback(async () => {
    setLoading(true); setError(false)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (cat) params.set('cat', String(cat))
    if (price) params.set('price', String(price))
    if (openNow) params.set('open', '1')
    if (pos) { params.set('lat', String(pos.lat)); params.set('lng', String(pos.lng)) }
    try {
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error(`search ${res.status}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      // Red caída o respuesta inválida: mostrar error con reintento en vez de colgar el spinner.
      setError(true)
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }, [q, cat, price, openNow, pos])

  const hasFilters = q.trim() !== '' || cat !== null || price !== null || openNow
  const clearFilters = useCallback(() => { setQ(''); setCat(null); setPrice(null); setOpenNow(false) }, [])

  // Busca al cambiar filtros (y con debounce el texto) una vez resuelta la ubicación.
  useEffect(() => {
    if (pos === null) return
    const t = setTimeout(search, 250)
    return () => clearTimeout(t)
  }, [search, pos])

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="sticky top-[57px] z-20 space-y-3 border-b border-line bg-surface/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="relative">
            <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca un lugar por nombre…"
              type="search"
              aria-label="Buscar lugar"
              enterKeyHint="search"
              autoComplete="off"
              className="w-full rounded-full border border-line bg-card py-2.5 pl-11 pr-5 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCat(cat === id ? null : id)}
                aria-pressed={cat === id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${cat === id ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}
              >
                <Icon size={15} strokeWidth={1.75} /> {label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              value={price ?? ''}
              onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : null)}
              className="select-chevron rounded-full border border-line bg-card px-3 py-1.5 text-sm text-fg-soft outline-none focus:border-goospe-green"
            >
              <option value="">Precio</option>
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
            <button
              onClick={() => setOpenNow((v) => !v)}
              aria-pressed={openNow}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${openNow ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}
            >
              <Clock size={15} strokeWidth={1.75} /> Abierto ahora
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <LocationNotice source={geoSource} onRetry={loadPos} className="mb-6" />
        {loading && (
          <div className="flex justify-center py-16">
            <Loader size={96} />
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-fg-soft">No pudimos completar la búsqueda. Revisa tu conexión e intenta de nuevo.</p>
            <button
              onClick={() => search()}
              className="rounded-full bg-goospe-green px-5 py-2 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
            >
              Reintentar
            </button>
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          !searched ? (
            <p className="py-16 text-center text-muted">Empieza a buscar lugares cerca de ti.</p>
          ) : hasFilters ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-fg-soft">Sin resultados con estos filtros.</p>
              <button
                onClick={clearFilters}
                className="rounded-full border border-line bg-card px-5 py-2 text-sm font-medium text-fg-soft transition hover:text-fg"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <p className="py-16 text-center text-muted">Aún no hay lugares publicados cerca de ti.</p>
          )
        )}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
