'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Compass, Heart, Share2, RefreshCw } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { Loader } from '@/shared/components/loader'
import { LocationNotice } from '@/shared/components/location-notice'
import { PhotoImg } from '@/shared/components/photo-img'
import { categoryIcon } from '@/shared/lib/icons'
import { appContainer } from '@/shared/lib/ui'
import { useFavorites } from '@/hooks/useFavorites'
import { getPosition, type GeoSource } from '@/lib/geo'
import { track } from '@/lib/track'

const EXAMPLES = [
  'algo romántico y barato',
  'café tranquilo para trabajar',
  'carrete con amigos',
  'comida rica cerca de mí',
]

const WITH_WHOM = [
  { v: 'solo', label: 'Solo' },
  { v: 'pareja', label: 'En pareja' },
  { v: 'amigos', label: 'Amigos' },
  { v: 'familia', label: 'Familia' },
] as const
type WithWhom = (typeof WITH_WHOM)[number]['v']
const BUDGETS = [1, 2, 3, 4]

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
  category_emoji?: string | null
  photo_url: string | null
  reason: string
}

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
// Chip de contexto sobre el degradado de marca.
const ctxChip = (on: boolean) =>
  `flex h-[34px] items-center justify-center rounded-full px-3 text-[13px] font-medium transition ${on ? 'bg-on-brand text-white' : 'bg-white/35 hover:bg-white/50'}`
const ROUND = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fg transition hover:border-goospe-green/50'

/** Lee el stream SSE del conserje y avisa de cada pick a medida que llega. */
async function readPicks(res: Response, onPick: (p: Pick) => void) {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
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
      if (evt.type === 'pick') onPick(evt.pick)
      else if (evt.type === 'error') throw new Error(evt.error)
    }
  }
}

// Placeholder con la forma de una opción → reserva la altura mientras los 3 picks llegan en
// streaming (evita el salto de layout tarjeta por tarjeta).
function PickSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-3xl border border-line bg-card md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-h-[170px] animate-pulse bg-ph md:min-h-[190px]" />
      <div className="space-y-2.5 p-5">
        <div className="h-5 w-1/2 animate-pulse rounded bg-line/60" />
        <div className="h-3.5 w-full animate-pulse rounded bg-line/50" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-line/50" />
      </div>
    </div>
  )
}

function PickCard({ p, n, saved, onSave }: { p: Pick; n: number; saved: boolean; onSave: () => void }) {
  const Cat = categoryIcon(p.category_emoji)
  const meta = [p.price_level ? '$'.repeat(p.price_level) : null, fmtDist(p.distance_m)].filter(Boolean).join(' · ')
  const onShare = () => {
    track('share', { placeId: p.id })
    navigator.share?.({ title: p.name, text: p.reason, url: `${location.origin}/places/${p.slug}` }).catch(() => {})
  }
  return (
    <article className="grid overflow-hidden rounded-3xl border border-line bg-card md:grid-cols-[220px_minmax(0,1fr)]">
      <Link href={`/places/${p.slug}`} className="relative block min-h-[170px] md:min-h-[190px]" tabIndex={-1} aria-hidden>
        <PhotoImg src={p.photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" fallback={<Cat size={40} strokeWidth={1.5} />} />
        <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1C1A] text-sm font-medium text-white">{n}</span>
      </Link>
      <div className="flex min-w-0 flex-col gap-1.5 px-5 py-[18px]">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/places/${p.slug}`} className="text-[19px] font-medium text-fg hover:text-ink">{p.name}</Link>
          <span className="shrink-0 text-[13px] text-muted">{meta}</span>
        </div>
        <p className="text-[15px] leading-normal text-fg-soft">
          <Sparkles size={14} strokeWidth={1.75} className="mr-1 inline align-[-2px] text-goospe-green" />{p.reason}
        </p>
        <div className="mt-auto flex gap-2 pt-2.5 text-sm font-medium">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('directions', { placeId: p.id })}
            className="inline-flex h-10 items-center gap-[7px] rounded-full bg-tint px-4 text-ink transition hover:bg-tint2"
          >
            <Compass size={16} strokeWidth={1.75} /> Cómo llego
          </a>
          <button onClick={onSave} aria-pressed={saved} aria-label={saved ? `Quitar ${p.name} de guardados` : `Guardar ${p.name}`}
            className={saved ? `${ROUND} !border-goospe-green !bg-goospe-green !text-on-brand` : ROUND}>
            <Heart size={16} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onShare} aria-label={`Compartir ${p.name}`} className={ROUND}>
            <Share2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * Decídeme — conserje IA. Izquierda (sticky en web): tarjeta con el pedido y dos chips de
 * contexto opcionales ("con quién" y "presupuesto") que viajan al endpoint junto al texto.
 * Derecha: las 3 opciones con su porqué y "Otras 3 opciones" (excluye las ya mostradas).
 * `?q=` (barra de prompt del landing) precarga el pedido y lo lanza una sola vez.
 */
export function ConciergeClient() {
  const initialQ = (useSearchParams().get('q') ?? '').trim().slice(0, 300)
  const [query, setQuery] = useState(initialQ)
  const [withWhom, setWithWhom] = useState<WithWhom | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [asked, setAsked] = useState('') // pedido al que responden las opciones en pantalla
  const [error, setError] = useState<string | null>(null)
  const [geoSource, setGeoSource] = useState<GeoSource>('forced')
  const shown = useRef<string[]>([]) // ids ya mostrados para este pedido ("Otras 3 opciones")
  const { isSaved, toggle } = useFavorites()

  // Resolvemos la ubicación al montar para avisar (y poder reintentar) si cae al fallback.
  const loadPos = useCallback(() => { getPosition().then((g) => setGeoSource(g.source)) }, [])
  useEffect(() => { loadPos() }, [loadPos])

  const ask = useCallback(async (q: string, more = false) => {
    if (q.trim().length < 2) return
    if (!more) shown.current = []
    setLoading(true); setError(null); setPicks(null); setAsked(q.trim())
    try {
      const { lat, lng, source } = await getPosition()
      setGeoSource(source)
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, lat, lng, withWhom, budget, exclude: shown.current.slice(-24) }),
      })
      // Cuota agotada u otro error → respuesta JSON, no stream.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error')
      }
      const acc: Pick[] = []
      setPicks([]) // empieza a mostrar resultados a medida que llegan
      await readPicks(res, (pick) => {
        acc.push(pick)
        shown.current.push(pick.id)
        setPicks([...acc])
        track('concierge_pick', { placeId: pick.id, context: { query: q } })
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [withWhom, budget])

  // Pedido que llega en la URL: se lanza una vez al montar.
  const autoAsked = useRef(false)
  useEffect(() => {
    if (autoAsked.current || !initialQ) return
    autoAsked.current = true
    void ask(initialQ)
  }, [initialQ, ask])

  const onSave = (id: string) => { track(toggle(id) ? 'save' : 'unsave', { placeId: id }) }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={`${appContainer} grid items-start gap-8 pb-14 pt-[18px] md:pt-7 lg:grid-cols-[400px_minmax(0,1fr)]`}>
        {/* pedido */}
        <form
          onSubmit={(e) => { e.preventDefault(); void ask(query) }}
          className="rounded-[28px] bg-goospe-gradient p-[clamp(22px,2.6vw,32px)] text-on-brand lg:sticky lg:top-[88px]"
        >
          <div className="flex items-center gap-[7px] text-[13px] font-medium"><Sparkles size={14} strokeWidth={1.75} /> Decídeme</div>
          <h1 className="mt-2.5 text-[clamp(32px,3.4vw,44px)] font-light leading-[1.02] tracking-[-0.025em]">
            ¿Dónde voy <span className="font-medium">hoy?</span>
          </h1>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(query) } }}
            placeholder="ej: algo chill y barato para 3 cerca del centro"
            aria-label="¿Qué buscas? Descríbelo en tus palabras"
            enterKeyHint="search"
            maxLength={300}
            rows={3}
            className="mt-5 block min-h-24 w-full resize-none rounded-[20px] bg-white p-4 text-base leading-[1.45] text-[#1C1C1A] outline-none placeholder:text-[#8C887F] focus:shadow-[0_0_0_4px_rgba(11,42,29,0.18)]"
          />

          <div className="mt-[18px] text-xs font-medium uppercase tracking-[0.1em]">Con quién</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WITH_WHOM.map((w) => (
              <button key={w.v} type="button" onClick={() => setWithWhom(withWhom === w.v ? null : w.v)} aria-pressed={withWhom === w.v} className={ctxChip(withWhom === w.v)}>
                {w.label}
              </button>
            ))}
          </div>

          <div className="mt-3.5 text-xs font-medium uppercase tracking-[0.1em]">Presupuesto</div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {BUDGETS.map((b) => (
              <button key={b} type="button" onClick={() => setBudget(budget === b ? null : b)} aria-pressed={budget === b} aria-label={`Presupuesto ${'$'.repeat(b)}`} className={ctxChip(budget === b)}>
                {'$'.repeat(b)}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="mt-[22px] flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1C1C1A] text-base font-medium text-white transition hover:bg-black disabled:opacity-60"
          >
            <Sparkles size={17} strokeWidth={1.75} /> {loading ? 'Pensando…' : 'Decidir'}
          </button>
        </form>

        {/* opciones. Región viva: anuncia "pensando" y la llegada de resultados. */}
        <div className="min-w-0" aria-live="polite" aria-busy={loading}>
          <LocationNotice source={geoSource} onRetry={loadPos} className="mb-5" />

          {/* aún sin pedido: ejemplos de un toque */}
          {picks === null && !loading && !error && (
            <div>
              <p className="text-sm">Escríbelo en tus palabras o prueba con una idea:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => { setQuery(ex); void ask(ex) }}
                    className="h-[38px] rounded-full border border-line bg-card px-3.5 text-sm text-fg-soft transition hover:border-goospe-green/50 hover:text-fg">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Antes de conectar el stream: loader de marca. Una vez abierto (picks=[]) pasamos
              a la lista con skeletons para que la altura quede reservada y no salte. */}
          {loading && picks === null && (
            <div className="flex flex-col items-center gap-3 py-10 text-fg-soft">
              <Loader size={120} />
              <p>Pensando en tus mejores opciones…</p>
            </div>
          )}

          {error && <p role="alert" className="rounded-[14px] bg-red-500/10 p-3 text-red-600 dark:text-red-400">{error}</p>}

          {picks !== null && (
            <>
              {!loading && picks.length === 0 ? (
                <p className="text-fg-soft">No encontré nada cerca para eso. Prueba otra cosa.</p>
              ) : (
                <>
                  <p className="text-sm">
                    {picks.length || 3} {picks.length === 1 ? 'opción' : 'opciones'} para <b className="font-medium text-fg">“{asked}”</b>
                  </p>
                  <div className="mt-4 flex flex-col gap-3.5">
                    {picks.map((p, i) => <PickCard key={p.id} p={p} n={i + 1} saved={isSaved(p.id)} onSave={() => onSave(p.id)} />)}
                    {loading && Array.from({ length: Math.max(0, 3 - picks.length) }).map((_, i) => <PickSkeleton key={`sk-${i}`} />)}
                  </div>
                  {!loading && picks.length > 0 && (
                    <button onClick={() => void ask(asked, true)}
                      className="mt-[18px] inline-flex h-11 items-center gap-2 rounded-full border border-line px-[18px] text-sm font-medium text-fg transition hover:border-goospe-green/50">
                      <RefreshCw size={15} strokeWidth={1.75} /> Otras 3 opciones
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
