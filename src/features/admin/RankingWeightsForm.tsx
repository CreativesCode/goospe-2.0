'use client'

import { useMemo, useState, useTransition } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { toast } from '@/shared/components/toast'
import { resetFeedWeights, saveFeedWeights } from '@/actions/admin-feed-config'
import {
  DEFAULT_WEIGHTS, WEIGHT_FIELDS, WEIGHT_KEYS, isDefaultWeights, organicShares, parseWeights,
  type RankingWeights, type WeightKey,
} from '@/features/feed/ranking-weights'

const SHARE_LABEL = { distance: 'Cercanía', trending: 'Tendencia', novelty: 'Variedad', affinity: 'Afinidad' } as const
const SHARE_COLOR = { distance: 'bg-goospe-green', trending: 'bg-amber-500', novelty: 'bg-sky-500', affinity: 'bg-fuchsia-500' } as const

const toText = (w: RankingWeights) =>
  Object.fromEntries(WEIGHT_KEYS.map((k) => [k, String(w[k])])) as Record<WeightKey, string>

/**
 * Editor de los pesos del ranking del feed. Campos controlados (un error del servidor no borra
 * lo escrito) y validación con el mismo schema que usa la server action.
 */
export function RankingWeightsForm({ initial }: { initial: RankingWeights }) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(() => toText(initial))
  const [pending, startTransition] = useTransition()

  const parsed = useMemo(() => parseWeights(values), [values])
  const preview = parsed.ok ? parsed.weights : null
  const dirty = preview ? WEIGHT_KEYS.some((k) => preview[k] !== saved[k]) : true
  const shares = preview ? organicShares(preview) : null
  const organicMax = preview ? preview.distance + preview.trending + preview.novelty + preview.affinity : 0

  function submit() {
    if (!parsed.ok) { toast.error(parsed.error); return }
    startTransition(async () => {
      const res = await saveFeedWeights(parsed.weights)
      if (res.error || !res.weights) { toast.error(res.error ?? 'No pudimos guardar los pesos.'); return }
      setSaved(res.weights)
      setValues(toText(res.weights))
      toast.success(res.unchanged ? 'Sin cambios' : 'Pesos guardados. El feed ya los usa.')
    })
  }

  function reset() {
    if (!window.confirm('¿Volver a los pesos originales del feed?')) return
    startTransition(async () => {
      const res = await resetFeedWeights()
      if (res.error || !res.weights) { toast.error(res.error ?? 'No pudimos restaurar los pesos.'); return }
      setSaved(res.weights)
      setValues(toText(res.weights))
      toast.success('Pesos originales restaurados')
    })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {WEIGHT_FIELDS.map((f) => {
          const changed = values[f.key] !== String(saved[f.key])
          return (
            <label key={f.key} className="block rounded-2xl border border-line bg-card p-4">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-fg">{f.label}</span>
                <span className="text-xs text-muted">original {DEFAULT_WEIGHTS[f.key]}</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                min={f.min}
                max={f.max}
                step={f.step}
                required
                className={`mt-2 w-full rounded-lg border bg-surface px-3 py-2 text-sm tabular-nums text-fg outline-none focus:border-goospe-green ${changed ? 'border-amber-500/70' : 'border-line'}`}
              />
              <span className="mt-1.5 block text-xs text-fg-soft">{f.help} Rango {f.min}–{f.max}.</span>
            </label>
          )
        })}
      </div>

      {/* Lectura rápida de la configuración que se va a guardar. Alto fijo: no salta al teclear. */}
      <div className="min-h-[92px] rounded-2xl border border-line bg-card p-4">
        {shares && preview ? (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
              {(Object.keys(SHARE_LABEL) as (keyof typeof SHARE_LABEL)[]).map((k) => (
                <div key={k} className={SHARE_COLOR[k]} style={{ width: `${shares[k]}%` }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-soft">
              {(Object.keys(SHARE_LABEL) as (keyof typeof SHARE_LABEL)[]).map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${SHARE_COLOR[k]}`} /> {SHARE_LABEL[k]} {shares[k]} %
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Un lugar sin boost puntúa como máximo {organicMax.toFixed(2)}.{' '}
              {preview.boost > organicMax
                ? 'El boost lo supera: un destacado dentro del radio sale siempre antes que cualquier lugar sin boost.'
                : 'El boost no lo supera: un destacado lejano puede quedar por debajo de lugares sin boost.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">{parsed.ok ? '' : parsed.error}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !parsed.ok || !dirty}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-goospe-green px-5 text-sm font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-50"
        >
          <Save size={16} strokeWidth={1.9} /> {pending ? 'Guardando…' : 'Guardar pesos'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending || isDefaultWeights(saved)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-fg-soft transition hover:text-fg disabled:opacity-50"
        >
          <RotateCcw size={15} strokeWidth={1.9} /> Restaurar originales
        </button>
        {dirty && parsed.ok && <span className="text-xs text-amber-700 dark:text-amber-400">Cambios sin guardar</span>}
      </div>
    </form>
  )
}
