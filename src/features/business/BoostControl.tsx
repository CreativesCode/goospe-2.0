'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createBoost, endBoost } from '@/actions/boosts'
import { fmtInZone } from '@/lib/tz'

type Boost = { id: string; ends_at: string }

// Fecha en la zona de la ciudad del lugar (mismo texto en servidor y navegador).
const fmt = (s: string, tz: string | null) => fmtInZone(s, tz, { day: 'numeric', month: 'long' })

/** `children`: bloque opcional bajo el control (rendimiento de los destacados). */
export function BoostControl({ placeId, active: initial, timeZone = null, children }: {
  placeId: string; active: Boost | null; timeZone?: string | null; children?: ReactNode
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [days, setDays] = useState(7)
  const [msg, setMsg] = useState<string | null>(null)
  // Resultado de la última acción: router.refresh() no repinta a tiempo. undefined = lo del servidor.
  const [local, setLocal] = useState<Boost | null | undefined>(undefined)
  const active = local !== undefined ? local : initial

  async function onCreate() {
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('days', String(days))
    const res = await createBoost(fd)
    setBusy(false)
    if (res?.error || !res.boost) { setMsg(res?.error ?? 'No pudimos destacar el lugar. Intenta de nuevo.'); return }
    setLocal(res.boost)
    router.refresh()
  }

  async function onEnd() {
    if (!active) return
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.set('boost_id', active.id)
    fd.set('place_id', placeId)
    const res = await endBoost(fd)
    setBusy(false)
    if (res?.error) { setMsg(res.error); return }
    setLocal(null)
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-goospe-green/20 bg-goospe-green/[0.04] p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-2 font-medium text-fg"><Sparkles size={18} strokeWidth={1.75} className="text-goospe-green" /> Destacar en el feed</h2>
        <span className="rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark">Gratis en el piloto</span>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-fg">
            Tu lugar está <strong className="text-goospe-green-dark">destacado</strong> hasta el {fmt(active.ends_at, timeZone)}.
          </p>
          <button onClick={onEnd} disabled={busy} className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-60">
            Terminar
          </button>
          {msg && <span className="w-full text-sm text-red-600">{msg}</span>}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-fg-soft">Súbelo al tope del feed por</p>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="select-chevron rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-fg outline-none focus:border-goospe-green">
            <option value={3}>3 días</option>
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
          <button onClick={onCreate} disabled={busy}
            className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-60">
            {busy ? 'Activando…' : 'Destacar ahora'}
          </button>
          {msg && <span className="text-sm text-red-600">{msg}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
