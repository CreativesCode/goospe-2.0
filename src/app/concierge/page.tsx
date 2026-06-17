'use client'

import { useState } from 'react'
import Link from 'next/link'
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

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

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
    <main className="min-h-[100dvh] bg-goospe-gradient">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/feed" className="mb-8 inline-block">
          <img src="/brand/logo-white.svg" alt="Goospe" className="h-7" />
        </Link>

        <h1 className="text-3xl font-medium text-white">¿Dónde voy hoy?</h1>
        <p className="mt-1 text-white/80">Dime qué buscas y te decido en segundos.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(query) }}
          className="mt-6 flex gap-2"
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
            className="rounded-full bg-white px-6 py-3 font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? '…' : 'Decidir'}
          </button>
        </form>

        {!picks && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); ask(ex) }}
                className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/25"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {loading && (!picks || picks.length === 0) && (
          <div className="mt-10 flex flex-col items-center gap-3 text-white/90">
            <img src="/brand/isotipo-white.svg" alt="" className="h-12 w-12 animate-pulse" />
            <p>Pensando en tus mejores opciones…</p>
          </div>
        )}

        {error && <p className="mt-6 rounded-lg bg-red-500/20 p-3 text-white">{error}</p>}

        {picks && (
          <div className="mt-8 space-y-4">
            {!loading && picks.length === 0 && <p className="text-white/90">No encontré nada cerca para eso. Prueba otra cosa.</p>}
            {picks.map((p, i) => (
              <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex">
                  <div className="relative h-32 w-32 shrink-0 bg-goospe-gradient">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <img src="/brand/isotipo-white.svg" alt="" className="h-8 w-8 opacity-90" />
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-goospe-green text-xs font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-center gap-2 text-xs text-goospe-gray/60">
                      <span>{p.category_name}</span><span>·</span><span>{fmtDist(p.distance_m)}</span>
                      {p.price_level ? <><span>·</span><span>{'$'.repeat(p.price_level)}</span></> : null}
                    </div>
                    <Link href={`/places/${p.slug}`}><h3 className="font-medium text-goospe-gray">{p.name}</h3></Link>
                    <p className="mt-1 text-sm font-medium text-goospe-green-dark">“{p.reason}”</p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                      target="_blank" rel="noreferrer"
                      className="mt-2 inline-block text-sm text-goospe-green hover:underline"
                    >
                      🧭 Cómo llego
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
