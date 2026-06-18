'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Clock, Star, Utensils, Coffee, Martini, Moon, Ticket, MapPin, type LucideIcon } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { getPosition } from '@/lib/geo'

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
const fmtDist = (m: number | null) => (m == null ? '' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

export default function BuscarPage() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [openNow, setOpenNow] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => { getPosition().then(setPos) }, [])

  const search = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (cat) params.set('cat', String(cat))
    if (price) params.set('price', String(price))
    if (openNow) params.set('open', '1')
    if (pos) { params.set('lat', String(pos.lat)); params.set('lng', String(pos.lng)) }
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setLoading(false)
  }, [q, cat, price, openNow, pos])

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
              className="w-full rounded-full border border-line bg-card py-2.5 pl-11 pr-5 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCat(cat === id ? null : id)}
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
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${openNow ? 'bg-goospe-green text-white' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}
            >
              <Clock size={15} strokeWidth={1.75} /> Abierto ahora
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {loading && <p className="text-sm text-muted">Buscando…</p>}
        {!loading && results.length === 0 && (
          <p className="py-16 text-center text-muted">Sin resultados. Prueba con otros filtros.</p>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((p) => {
            const Cat = categoryIcon(p.category_emoji)
            return (
            <Link
              href={`/places/${p.slug}`}
              key={p.id}
              className="group block overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-goospe-gradient text-white">
                    <Cat size={44} strokeWidth={1.5} />
                  </div>
                )}
                {p.open_now === true && (
                  <span className="absolute left-2 top-2 rounded-full bg-goospe-green px-2 py-0.5 text-[10px] font-medium text-white shadow">Abierto</span>
                )}
              </div>
              <div className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium leading-tight text-fg">{p.name}</h2>
                  {p.price_level ? <span className="shrink-0 text-sm text-muted">{'$'.repeat(p.price_level)}</span> : null}
                </div>
                {p.vibe_line && <p className="text-sm font-medium text-goospe-green">{p.vibe_line}</p>}
                <p className="flex items-center gap-2 pt-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Cat size={13} strokeWidth={1.75} /> {p.category_name}</span>
                  {p.distance_m != null && <><span>·</span><span className="inline-flex items-center gap-1"><MapPin size={12} strokeWidth={1.75} /> {fmtDist(p.distance_m)}</span></>}
                  {p.rating > 0 && <><span>·</span><span className="inline-flex items-center gap-1"><Star size={12} strokeWidth={1.75} fill="currentColor" /> {Number(p.rating).toFixed(1)}</span></>}
                </p>
              </div>
            </Link>
            )
          })}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
