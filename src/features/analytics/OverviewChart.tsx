'use client'

import { useState } from 'react'
import { RANGES, bucketLabel, tickIndexes, type RangeDays } from '@/features/analytics/metrics'

const nf = new Intl.NumberFormat('es-CL')
const DAY_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
// Las claves son días calendario (YYYY-MM-DD) ya cortados en la zona de la ciudad.
const dayInitial = (key: string) => DAY_INITIAL[new Date(`${key}T00:00:00Z`).getUTCDay()] ?? ''
const BEST = 'bg-[linear-gradient(180deg,#27f1a0,#28af79)]'

/** Eje X: con 7 días la inicial de cada día; con 30 y 90 solo algunas fechas para que no se pisen. */
function XAxis({ keys, weekly, gap }: { keys: string[]; weekly: boolean; gap: string }) {
  const ticks = new Set(weekly ? keys.map((_, i) => i) : tickIndexes(keys.length, 6))
  const edge = (i: number) => (weekly ? '' : i === keys.length - 1 ? 'right-0' : i === 0 ? 'left-0' : '')
  return (
    <div className={`mt-2 flex h-4 ${gap}`} aria-hidden="true">
      {keys.map((key, i) => (
        <div key={key} className="relative min-w-0 flex-1">
          {ticks.has(i) && (
            <span className={`absolute top-0 whitespace-nowrap text-xs text-muted ${edge(i) || 'left-1/2 -translate-x-1/2'}`}>
              {weekly ? dayInitial(key) : bucketLabel('day', key)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Gráfico de barras del Resumen: una serie diaria con la mejor barra del periodo resaltada.
 * Recibe los 90 días ya cargados (`keys` y `values` alineados, del más antiguo a hoy) y el
 * selector 7/30/90 solo recorta: cambiar de rango no vuelve al servidor.
 */
export function OverviewChart({ title, unit, keys, values }: { title: string; unit: string; keys: string[]; values: number[] }) {
  const [days, setDays] = useState<RangeDays>(7)
  const k = keys.slice(-days)
  const v = values.slice(-days)
  const total = v.reduce((s, n) => s + n, 0)
  const peak = Math.max(0, ...v)
  const bestAt = peak > 0 ? v.indexOf(peak) : -1
  const gap = days === 7 ? 'gap-2.5' : days === 30 ? 'gap-1' : 'gap-px'
  const summary = total === 0
    ? 'Sin actividad en este periodo'
    : `${nf.format(total)} ${unit} · mejor día: ${bucketLabel('day', k[bestAt])} (${nf.format(peak)})`

  return (
    <figure className="m-0 min-w-0 rounded-[22px] border border-line bg-card p-[22px]">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-medium text-fg">{title}</span>
        <div role="group" aria-label="Rango de fechas" className="flex gap-0.5 rounded-full border border-line p-[3px] text-xs font-medium">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
              className={`rounded-full px-2.5 py-1 transition ${days === d ? 'bg-tint2 text-ink' : 'text-fg-soft hover:text-fg'}`}>{d} d</button>
          ))}
        </div>
      </figcaption>
      <p className="mt-1 text-xs text-muted" aria-live="polite">{summary}</p>

      <div role="img" aria-label={`${title}, últimos ${days} días. ${summary}.`} className={`mt-4 flex h-[180px] items-end ${gap}`}>
        {v.map((n, i) => (
          <div key={k[i]} title={`${bucketLabel('day', k[i])}: ${nf.format(n)} ${unit}`} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <div
              className={`w-full max-w-[44px] ${days === 7 ? 'rounded-[10px_10px_4px_4px]' : 'rounded-t-[3px]'} ${n === 0 ? 'bg-line' : i === bestAt ? BEST : 'bg-tint2'}`}
              style={{ height: n > 0 ? `max(4px, ${(n / peak) * 100}%)` : 2 }}
            />
          </div>
        ))}
      </div>
      <XAxis keys={k} weekly={days === 7} gap={gap} />
    </figure>
  )
}
