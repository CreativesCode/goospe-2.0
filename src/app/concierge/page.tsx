'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { Loader } from '@/shared/components/loader'
import { PlaceCard } from '@/features/places/PlaceCard'
import { getPosition } from '@/lib/geo'
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

export default function ConciergePage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    if (q.trim().length < 2) return
    setLoading(true); setError(null); setPicks(null)
    try {
      const { lat, lng } = await getPosition()
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
              className="flex-1 rounded-full border-0 px-5 py-3 text-goospe-gray shadow-lg outline-none ring-goospe-green-light focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
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

        {loading && (!picks || picks.length === 0) && (
          <div className="mt-10 flex flex-col items-center gap-3 text-fg-soft">
            <Loader size={120} />
            <p>Pensando en tus mejores opciones…</p>
          </div>
        )}

        {error && <p className="mt-6 rounded-xl bg-red-500/10 p-3 text-red-600">{error}</p>}

        {picks && (
          <div className="mt-8">
            {!loading && picks.length === 0 && <p className="text-fg-soft">No encontré nada cerca para eso. Prueba otra cosa.</p>}
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
            </div>
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
