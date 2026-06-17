'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <section className="rounded-2xl border border-goospe-green/20 bg-goospe-green/[0.04] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-goospe-gray">📊 Tu semana en 5 líneas</h2>
          <span className="rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark">IA</span>
        </div>
        <button onClick={generate} disabled={busy}
          className="shrink-0 rounded-full bg-goospe-gradient px-4 py-1.5 text-sm font-medium text-white shadow disabled:opacity-60">
          {busy ? 'Generando…' : summary ? 'Actualizar' : 'Generar informe'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary ? (
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-goospe-gray/90">{summary}</div>
      ) : (
        <p className="mt-3 text-sm text-goospe-gray/60">
          Genera un resumen de cómo le fue a tu lugar esta semana: vistas, guardados y qué dijo la gente.
        </p>
      )}
    </section>
  )
}
