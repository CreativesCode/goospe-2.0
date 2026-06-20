'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { COUNTRIES } from '../data/geo-catalog'
import { searchZoneCities, startZoneLoad, type ZoneCandidate } from '@/actions/loader'

const selectClass =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none focus:ring-2 focus:ring-goospe-green/40'

// 3 selects encadenados (País → Región → Ciudad). La ciudad se busca en Nominatim
// (devuelve bbox); al confirmar, lanza el job y avisa al padre con el jobId.
export function ZonePicker({ onStarted }: { onStarted: (jobId: string) => void }) {
  const [countryCode, setCountryCode] = useState('')
  const [region, setRegion] = useState('')
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<ZoneCandidate[]>([])
  const [selected, setSelected] = useState<ZoneCandidate | null>(null)
  const [busy, setBusy] = useState<'idle' | 'searching' | 'starting'>('idle')
  const [error, setError] = useState('')

  const country = COUNTRIES.find((c) => c.code === countryCode)

  async function onSearch() {
    if (!country || !region || q.trim().length < 2) return
    setBusy('searching'); setError(''); setCandidates([]); setSelected(null)
    const res = await searchZoneCities({ countryCode, region, q: q.trim() })
    setBusy('idle')
    if ('error' in res) setError(res.error)
    else if (!res.candidates.length) setError('Sin resultados en Nominatim para esa búsqueda.')
    else setCandidates(res.candidates)
  }

  async function onStart() {
    if (!selected || !country) return
    setBusy('starting'); setError('')
    const res = await startZoneLoad({
      countryCode, region, cityName: selected.name,
      lat: selected.lat, lng: selected.lng, bbox: selected.bbox,
    })
    setBusy('idle')
    if ('error' in res) setError(res.error)
    else onStarted(res.jobId)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-soft">País</span>
          <select
            className={selectClass}
            value={countryCode}
            onChange={(e) => { setCountryCode(e.target.value); setRegion(''); setCandidates([]); setSelected(null) }}
          >
            <option value="">Elige país…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-soft">Región / Provincia</span>
          <select
            className={selectClass}
            value={region}
            disabled={!country}
            onChange={(e) => { setRegion(e.target.value); setCandidates([]); setSelected(null) }}
          >
            <option value="">{country ? 'Elige región…' : 'Elige país primero'}</option>
            {country?.regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-fg-soft">Ciudad</span>
        <div className="flex gap-2">
          <input
            className={selectClass}
            placeholder="Nombre de la ciudad (ej. Frutillar)"
            value={q}
            disabled={!region}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
          />
          <button
            onClick={onSearch}
            disabled={!region || q.trim().length < 2 || busy !== 'idle'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-goospe-green px-4 py-2.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-50"
          >
            {busy === 'searching' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
          </button>
        </div>
      </div>

      {candidates.length > 0 && (
        <ul className="space-y-1.5">
          {candidates.map((c, i) => (
            <li key={`${c.lat}-${c.lng}-${i}`}>
              <button
                onClick={() => setSelected(c)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selected === c ? 'border-goospe-green bg-goospe-green/10 text-fg' : 'border-line bg-surface text-fg-soft hover:border-goospe-green/40'
                }`}
              >
                <span className="font-medium text-fg">{c.name}</span>{' '}
                <span className="text-xs text-muted">· {c.type} · {c.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={onStart}
        disabled={!selected || busy !== 'idle'}
        className="inline-flex items-center gap-2 rounded-full bg-goospe-gradient px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-95 disabled:opacity-50"
      >
        {busy === 'starting' ? <Loader2 size={16} className="animate-spin" /> : null}
        Cargar esta zona
      </button>
    </div>
  )
}
