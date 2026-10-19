'use client'

import { useEffect, useRef, useState } from 'react'
import { niceMax, tickIndexes } from '@/features/analytics/metrics'

const nf = new Intl.NumberFormat('es-CL')
export const fmtNum = (n: number) => nf.format(n)

/**
 * Gráfico de barras de UNA serie, en CSS puro (sin librerías). Una sola serie = un solo color
 * (verde de marca) y sin leyenda: el título nombra la métrica. Los textos van en tokens de texto.
 * Accesible: resumen en aria-label, lectura del valor al tocar o pasar por una barra y vista de
 * tabla con todos los datos (el verde sobre fondo claro no llega a contraste AA por sí solo).
 */
export function BarChart({ title, unit, labels, values, maxTicks = 6 }: {
  title: string; unit: string; labels: string[]; values: number[]; maxTicks?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const barsRef = useRef<HTMLDivElement>(null)
  // Táctil: la selección se suelta al tocar fuera de las barras.
  useEffect(() => {
    if (active === null) return
    const onDown = (e: PointerEvent) => {
      if (!barsRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active])
  const total = values.reduce((s, v) => s + v, 0)
  const peak = Math.max(0, ...values)
  const max = niceMax(peak)
  const peakAt = values.indexOf(peak)
  const ticks = new Set(tickIndexes(labels.length, maxTicks))
  const shown = active !== null && active < values.length ? active : null

  const readout = shown !== null
    ? `${labels[shown]}: ${fmtNum(values[shown])} ${unit}`
    : total === 0
      ? 'Sin actividad en este periodo'
      : `Máximo: ${fmtNum(peak)} (${labels[peakAt]})`

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-xs text-fg-soft" aria-live="polite">{readout}</span>
      </figcaption>

      <div className="mt-3 flex gap-2">
        {/* eje Y: tope, mitad y cero */}
        <div className="flex h-40 w-7 shrink-0 flex-col justify-between text-right text-[10px] leading-none text-muted" aria-hidden="true">
          <span>{fmtNum(max)}</span><span>{fmtNum(max / 2)}</span><span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-40">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              <span className="border-t border-line" /><span className="border-t border-dashed border-line" /><span className="border-t border-line" />
            </div>
            <div
              role="img"
              aria-label={`${title}. Total ${fmtNum(total)} ${unit}. ${total ? `Máximo ${fmtNum(peak)} en ${labels[peakAt]}.` : 'Sin actividad.'}`}
              className={`absolute inset-0 flex items-end ${values.length > 40 ? 'gap-px' : 'gap-0.5 sm:gap-1'}`}
              ref={barsRef}
              // En táctil, levantar el dedo dispara pointerleave: la selección debe quedarse.
              onPointerLeave={(e) => { if (e.pointerType !== 'touch') setActive(null) }}
            >
              {values.map((v, i) => (
                // La columna entera es la zona de toque (más grande que la barra).
                <div key={i} className="flex h-full min-w-0 flex-1 cursor-pointer items-end"
                  onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
                  <div
                    className={`w-full rounded-t-[3px] bg-goospe-green transition-opacity ${shown !== null && shown !== i ? 'opacity-40' : ''}`}
                    style={{ height: v > 0 ? `max(2px, ${(v / max) * 100}%)` : 0 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* eje X: solo algunas etiquetas para que no se pisen a 390 px */}
          <div className={`mt-1 flex h-4 ${values.length > 40 ? 'gap-px' : 'gap-0.5 sm:gap-1'}`} aria-hidden="true">
            {labels.map((l, i) => (
              <div key={i} className="relative min-w-0 flex-1">
                {ticks.has(i) && (
                  <span className={`absolute top-0 whitespace-nowrap text-[10px] text-muted ${i === labels.length - 1 ? 'right-0' : i === 0 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>{l}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-medium text-ink">Ver como tabla</summary>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-card text-left text-xs text-muted">
              <tr><th scope="col" className="px-3 py-2 font-medium">Periodo</th><th scope="col" className="px-3 py-2 text-right font-medium">{title}</th></tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-fg-soft">{l}</th>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg">{fmtNum(values[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
