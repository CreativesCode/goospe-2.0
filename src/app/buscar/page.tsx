'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
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

const CATEGORIES = [
  { id: 1, label: '🍽️ Comer' },
  { id: 2, label: '☕ Café' },
  { id: 3, label: '🍸 Beber' },
  { id: 4, label: '🌙 Noche' },
  { id: 5, label: '🎫 Eventos' },
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
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 space-y-3 border-b border-black/5 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/feed" className="text-sm text-goospe-gray/70 hover:text-goospe-green">← Feed</Link>
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-6" />
        </div>
        <div className="mx-auto max-w-5xl space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un lugar por nombre…"
            className="w-full rounded-full border border-black/10 px-5 py-2.5 text-goospe-gray outline-none focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
          />
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(cat === c.id ? null : c.id)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${cat === c.id ? 'bg-goospe-green text-white' : 'bg-gray-100 text-goospe-gray hover:bg-gray-200'}`}
              >
                {c.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-black/10" />
            <select
              value={price ?? ''}
              onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : null)}
              className="rounded-full border border-black/10 px-3 py-1.5 text-sm text-goospe-gray outline-none focus:border-goospe-green"
            >
              <option value="">Precio</option>
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
            <button
              onClick={() => setOpenNow((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${openNow ? 'bg-goospe-green text-white' : 'bg-gray-100 text-goospe-gray hover:bg-gray-200'}`}
            >
              🕒 Abierto ahora
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {loading && <p className="text-sm text-goospe-gray/50">Buscando…</p>}
        {!loading && results.length === 0 && (
          <p className="py-16 text-center text-goospe-gray/50">Sin resultados. Prueba con otros filtros.</p>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((p) => (
            <Link
              href={`/places/${p.slug}`}
              key={p.id}
              className="group block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-goospe-gradient">
                    <span className="text-5xl">{p.category_emoji ?? '📍'}</span>
                  </div>
                )}
                {p.open_now === true && (
                  <span className="absolute left-2 top-2 rounded-full bg-goospe-green px-2 py-0.5 text-[10px] font-medium text-white shadow">Abierto</span>
                )}
              </div>
              <div className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium leading-tight text-goospe-gray">{p.name}</h2>
                  {p.price_level ? <span className="shrink-0 text-sm text-goospe-gray/50">{'$'.repeat(p.price_level)}</span> : null}
                </div>
                {p.vibe_line && <p className="text-sm font-medium text-goospe-green">{p.vibe_line}</p>}
                <p className="flex items-center gap-2 pt-1 text-xs text-goospe-gray/50">
                  <span>{p.category_emoji} {p.category_name}</span>
                  {p.distance_m != null && <><span>·</span><span>{fmtDist(p.distance_m)}</span></>}
                  {p.rating > 0 && <><span>·</span><span>⭐ {Number(p.rating).toFixed(1)}</span></>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
