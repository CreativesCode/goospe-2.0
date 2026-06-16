'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Puerto Varas centro (fallback si el usuario no da ubicación)
const FALLBACK = { lat: -41.3195, lng: -72.9854 }

type FeedItem = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  description: string | null
  tags: string[] | null
  price_level: number | null
  lat: number
  lng: number
  distance_m: number
  rating: number
  reviews_count: number
  photo_url: string | null
  category_emoji: string | null
  category_name: string | null
}

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

const SAVED_KEY = 'goospe:saved'
const loadSaved = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => setSaved(loadSaved()), [])

  const fetchFeed = useCallback(async (lat: number, lng: number) => {
    // `as never` en los args: workaround del tipado de rpc de supabase-js para funciones
    // que retornan tabla (infiere los args como undefined). El runtime es correcto.
    const { data, error } = await supabase.rpc('get_feed', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: 25000,
      p_limit: 40,
      p_offset: 0,
    } as never)
    if (error) setError(error.message)
    else setItems((data ?? []) as FeedItem[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!navigator.geolocation) return void fetchFeed(FALLBACK.lat, FALLBACK.lng)
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchFeed(pos.coords.latitude, pos.coords.longitude),
      () => fetchFeed(FALLBACK.lat, FALLBACK.lng),
      { timeout: 6000 }
    )
  }, [fetchFeed])

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-goospe-gradient">
        <img src="/brand/isotipo-white.svg" alt="" className="h-14 w-14 animate-pulse" />
        <p className="text-sm text-white/80">Buscando lugares cerca de ti…</p>
      </div>
    )
  }
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>

  return (
    <main className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll bg-black">
      {/* logo flotante */}
      <Link href="/places" className="fixed left-4 top-4 z-20">
        <img src="/brand/logo-white.svg" alt="Goospe" className="h-6 drop-shadow" />
      </Link>

      {/* conserje (FAB) */}
      <Link
        href="/concierge"
        className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-goospe-gradient px-6 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/30"
      >
        ✨ Decídeme
      </Link>

      {items.map((p) => (
        <section key={p.id} className="relative h-[100dvh] w-full snap-start snap-always">
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

          {/* acciones laterales */}
          <div className="absolute bottom-40 right-4 z-10 flex flex-col gap-5 text-white">
            <button onClick={() => toggleSave(p.id)} className="flex flex-col items-center gap-1">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl backdrop-blur transition ${saved.has(p.id) ? 'bg-goospe-green' : 'bg-white/20'}`}>
                {saved.has(p.id) ? '❤️' : '🤍'}
              </span>
              <span className="text-xs">Guardar</span>
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl backdrop-blur">🧭</span>
              <span className="text-xs">Cómo llego</span>
            </a>
            <button
              onClick={() =>
                navigator.share?.({ title: p.name, text: p.vibe_line ?? p.name, url: `${location.origin}/places/${p.slug}` }).catch(() => {})
              }
              className="flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl backdrop-blur">📤</span>
              <span className="text-xs">Compartir</span>
            </button>
          </div>

          {/* info */}
          <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-10 text-white">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span>{p.category_emoji} {p.category_name}</span>
              <span>·</span>
              <span>{fmtDist(p.distance_m)}</span>
              {p.rating > 0 && <><span>·</span><span>⭐ {Number(p.rating).toFixed(1)}</span></>}
              {p.price_level ? <><span>·</span><span>{'$'.repeat(p.price_level)}</span></> : null}
            </div>
            <Link href={`/places/${p.slug}`} className="block">
              <h2 className="text-3xl font-medium leading-tight drop-shadow">{p.name}</h2>
            </Link>
            {p.vibe_line && <p className="text-lg font-medium text-goospe-green-light drop-shadow">{p.vibe_line}</p>}
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
      ))}

      {/* fin */}
      <section className="flex h-[40vh] snap-start flex-col items-center justify-center gap-2 bg-black text-white/60">
        <img src="/brand/isotipo-white.svg" alt="" className="h-10 w-10 opacity-50" />
        <p className="text-sm">Eso es todo cerca de ti por ahora</p>
      </section>
    </main>
  )
}
