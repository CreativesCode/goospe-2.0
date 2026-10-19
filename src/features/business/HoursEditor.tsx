'use client'

import { useState } from 'react'
import { Plus, X, Copy } from 'lucide-react'
import { humanizeHours } from '@/lib/hours'
import {
  DAY_LABELS, MAX_RANGES_PER_DAY, emptyWeek, osmToHoursInput, validateWeek,
  type DaySchedule, type HoursInput, type HoursMode, type WeekSchedule,
} from '@/lib/hours-editor'
import { hintClass, linkBtn } from '@/features/business/ui'

const MODES: { value: HoursMode; label: string }[] = [
  { value: 'custom', label: 'Por día' },
  { value: 'always', label: 'Abierto 24 horas' },
  { value: 'unset', label: 'Sin horario' },
]
const timeInput =
  'w-[6.5rem] rounded-lg border border-line bg-card px-2 py-2 text-sm text-fg outline-none focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30'
const DEFAULT_RANGE = { from: '09:00', to: '18:00' }

function DayRow({ index, day, onChange, onCopy }: {
  index: number; day: DaySchedule; onChange: (d: DaySchedule) => void; onCopy?: () => void
}) {
  const label = DAY_LABELS[index]
  const setRange = (i: number, key: 'from' | 'to', value: string) =>
    onChange({ ...day, ranges: day.ranges.map((r, k) => (k === i ? { ...r, [key]: value } : r)) })

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{label}</span>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-soft">
          <input
            type="checkbox"
            checked={day.closed}
            onChange={(e) => onChange(e.target.checked ? { closed: true, ranges: [] } : { closed: false, ranges: [DEFAULT_RANGE] })}
            className="h-4 w-4 accent-goospe-green"
          />
          Cerrado
        </label>
      </div>

      {!day.closed && (
        <div className="mt-1 space-y-2">
          {day.ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" value={r.from} onChange={(e) => setRange(i, 'from', e.target.value)}
                aria-label={`${label}: abre (tramo ${i + 1})`} className={timeInput} />
              <span className="text-sm text-muted">a</span>
              <input type="time" value={r.to} onChange={(e) => setRange(i, 'to', e.target.value)}
                aria-label={`${label}: cierra (tramo ${i + 1})`} className={timeInput} />
              {day.ranges.length > 1 && (
                <button type="button" onClick={() => onChange({ ...day, ranges: day.ranges.filter((_, k) => k !== i) })}
                  aria-label={`${label}: quitar tramo ${i + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:text-red-600">
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {day.ranges.length < MAX_RANGES_PER_DAY && (
              <button type="button" className={linkBtn}
                onClick={() => onChange({ ...day, ranges: [...day.ranges, { from: '19:00', to: '23:00' }] })}>
                <Plus size={14} strokeWidth={2} /> Agregar tramo
              </button>
            )}
            {onCopy && (
              <button type="button" onClick={onCopy} className={linkBtn}>
                <Copy size={13} strokeWidth={2} /> Copiar a todos los días
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * Editor de horario por día (varios tramos y "cerrado"). Solo escribe el campo oculto `hours`
 * cuando el dueño cambió algo: si no lo toca, el servidor conserva el horario guardado (así no
 * se pisa un horario de OSM que el editor no sabe representar).
 */
export function HoursEditor({ initialRaw }: { initialRaw: string | null }) {
  const [parsed] = useState(() => osmToHoursInput(initialRaw))
  const [value, setValue] = useState<HoursInput>(parsed ?? { mode: 'custom', days: emptyWeek() })
  const [dirty, setDirty] = useState(false)
  // Horario actual ilegible para el editor: se muestra tal cual hasta que el dueño decida reemplazarlo.
  const [locked, setLocked] = useState(parsed === null)

  const update = (next: HoursInput) => { setValue(next); setDirty(true) }
  const setDay = (i: number, d: DaySchedule) =>
    update({ ...value, days: value.days.map((x, k) => (k === i ? d : x)) })
  const copyToAll = (from: DaySchedule) =>
    update({ ...value, days: value.days.map(() => ({ closed: from.closed, ranges: from.ranges.map((r) => ({ ...r })) })) as WeekSchedule })
  const problem = value.mode === 'custom' ? validateWeek(value.days) : null

  if (locked) {
    return (
      <div className="rounded-xl bg-surface p-3">
        <p className="text-sm text-fg-soft">
          {(humanizeHours(initialRaw) ?? [initialRaw ?? '']).map((l, i) => <span key={i} className="block">{l}</span>)}
        </p>
        <p className={`mt-2 ${hintClass}`}>Este horario viene de una fuente externa con un formato especial. Si lo editas, se reemplaza por el que definas aquí.</p>
        <button type="button" onClick={() => setLocked(false)} className={`mt-2 ${linkBtn}`}>Definir mi horario</button>
      </div>
    )
  }

  return (
    <div>
      {dirty && <input type="hidden" name="hours" value={JSON.stringify(value)} />}
      <div role="radiogroup" aria-label="Tipo de horario" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={value.mode === m.value}
            onClick={() => update({ ...value, mode: m.value })}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${value.mode === m.value ? 'bg-goospe-green text-on-brand' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === 'custom' && (
        <>
          <ul className="mt-2 divide-y divide-line">
            {value.days.map((d, i) => (
              <DayRow key={i} index={i} day={d} onChange={(next) => setDay(i, next)}
                onCopy={i === 0 && !d.closed ? () => copyToAll(d) : undefined} />
            ))}
          </ul>
          {problem
            ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>
            : <p className={hintClass}>Si cierras después de medianoche, escribe la hora del día siguiente (ej. 20:00 a 02:00).</p>}
        </>
      )}
      {value.mode === 'unset' && <p className={`mt-2 ${hintClass}`}>La ficha no mostrará horario ni “abierto ahora”.</p>}
    </div>
  )
}
