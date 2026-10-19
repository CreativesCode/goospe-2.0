'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { generateWeeklyReport } from '@/actions/reports'

export function WeeklyReport({
  placeId, latest,
}: {
  placeId: string; latest: { summary: string; created_at: string } | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState(latest?.summary ?? null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true); setError(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    const res = await generateWeeklyReport(fd)
    setBusy(false)
    if (res?.error) setError(res.error)
    else { setSummary(res.summary ?? ''); router.refresh() }
  }

  return (
    <section id="informe" className="scroll-mt-32 rounded-[22px] border border-goospe-green/20 bg-goospe-green/[0.04] p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="inline-flex items-center gap-2 font-medium text-fg"><BarChart3 size={18} strokeWidth={1.75} className="text-ink" /> Tu semana en 5 líneas</h2>
          <span className="rounded-full bg-tint2 px-2 py-0.5 text-[10px] font-medium text-ink">IA</span>
        </div>
        <button onClick={generate} disabled={busy}
          className="min-h-11 shrink-0 rounded-full bg-goospe-green px-4 py-1.5 text-sm font-medium text-on-brand transition hover:brightness-105 disabled:opacity-60">
          {busy ? 'Generando…' : summary ? 'Actualizar' : 'Generar informe'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary ? (
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg">{summary}</div>
      ) : (
        <p className="mt-3 text-sm text-fg-soft">
          Genera un resumen de cómo le fue a tu lugar esta semana: vistas, guardados y qué dijo la gente.
        </p>
      )}
    </section>
  )
}
