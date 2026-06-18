'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { Loader } from '@/shared/components/loader'
import { LocationNotice } from '@/shared/components/location-notice'
import { PlaceCard } from '@/features/places/PlaceCard'
import { getPosition, type GeoSource } from '@/lib/geo'
import { track } from '@/lib/track'

const EXAMPLES = [
  'algo romántico y barato',
  'café tranquilo para trabajar',
  'carrete con amigos',
  'comida rica cerca de mí',
]

type Pick = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  price_level: number | null
  lat: number
  lng: number
  distance_m: number
  category_name: string | null
  photo_url: string | null
  reason: string
}

// Placeholder con la misma forma que PlaceCard → reserva la altura del grid mientras los
// 3 picks llegan en streaming (evita el salto de layout card por card). El conserje da 3.
function PickSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-line/60" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-line/50" />
      </div>
    </div>
  )
}

export default function ConciergePage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')

  // Resolvemos la ubicación al montar para avisar (y poder reintentar) si cae al fallback.
  const loadPos = useCallback(() => { getPosition().then((g) => setGeoSource(g.source)) }, [])
  useEffect(() => { loadPos() }, [loadPos])

  async function ask(q: string) {
    if (q.trim().length < 2) return
    setLoading(true); setError(null); setPicks(null)
    try {
      const { lat, lng, source } = await getPosition()
      setGeoSource(source)
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, lat, lng }),
      })
      // Cuota agotada u otro error → respuesta JSON, no stream.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error')
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      const acc: Pick[] = []
      setPicks([]) // empieza a mostrar resultados a medida que llegan

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i: number
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i).trim()
          buf = buf.slice(i + 2)
          if (!chunk.startsWith('data:')) continue
          const evt = JSON.parse(chunk.slice(5).trim())
          if (evt.type === 'pick') {
            acc.push(evt.pick)
            setPicks([...acc])
            track('concierge_pick', { placeId: evt.pick.id, context: { query: q } })
          } else if (evt.type === 'error') {
            throw new Error(evt.error)
          }
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="mx-auto max-w-2xl px-5 py-8">
        {/* hero del conserje (gradiente) */}
        <div className="rounded-3xl bg-goospe-gradient p-6 text-white shadow-lg sm:p-8">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">¿Dónde voy <span className="font-medium">hoy?</span></h1>
          <p className="mt-1 text-white/85">Dime qué buscas y te decido en segundos.</p>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(query) }}
            className="mt-6 flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ej: algo chill y barato para 3 personas…"
              aria-label="¿Qué buscas? Descríbelo en tus palabras"
              type="search"
              enterKeyHint="search"
              className="flex-1 rounded-full border-0 px-5 py-3 text-goospe-gray shadow-lg outline-none ring-goospe-green-light focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              aria-label={loading ? 'Buscando opciones' : 'Decidir'}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90 disabled:opacity-60"
            >
              <Sparkles size={18} strokeWidth={1.75} /> {loading ? '…' : 'Decidir'}
            </button>
          </form>

          {!picks && !loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setQuery(ex); ask(ex) }}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/25"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        <LocationNotice source={geoSource} onRetry={loadPos} className="mt-6" />

        {/* Región viva: anuncia "pensando" y la llegada de resultados a lectores de pantalla. */}
        <div aria-live="polite" aria-busy={loading}>
        {/* Antes de conectar el stream: loader de marca. Una vez abierto (picks=[]) pasamos
            al grid con skeletons para que la altura quede reservada y no salte. */}
        {loading && picks === null && (
          <div className="mt-10 flex flex-col items-center gap-3 text-fg-soft">
            <Loader size={120} />
            <p>Pensando en tus mejores opciones…</p>
          </div>
        )}

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-3 text-red-600">{error}</p>}

        {picks !== null && (
          <div className="mt-8">
            {!loading && picks.length === 0 && <p className="text-fg-soft">No encontré nada cerca para eso. Prueba otra cosa.</p>}
            {(picks.length > 0 || loading) && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {picks.map((p, i) => (
                  <PlaceCard
                    key={p.id}
                    place={p}
                    rank={i + 1}
                    reason={p.reason}
                    directions={{ lat: p.lat, lng: p.lng, onClick: () => track('directions', { placeId: p.id }) }}
                  />
                ))}
                {loading && Array.from({ length: Math.max(0, 3 - picks.length) }).map((_, i) => <PickSkeleton key={`sk-${i}`} />)}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
