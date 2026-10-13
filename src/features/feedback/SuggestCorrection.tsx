'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Flag } from 'lucide-react'
import { suggestCorrection } from '@/actions/feedback'
import { toast } from '@/shared/components/toast'
import { fieldClass, ghostBtn, hintClass, labelClass, linkBtn, primaryBtn } from '@/features/business/ui'
import { Honeypot } from '@/features/feedback/FeedbackForm'
import {
  CORRECTION_CATEGORIES, CORRECTION_LABELS, MESSAGE_MAX, NOTE_REQUIRED, type CorrectionCategory,
} from '@/features/feedback/feedback-schema'

/**
 * "Sugerir una corrección" en la ficha de un lugar: horario mal, cerró, pin mal, duplicado u
 * otro, con una nota. No cambia el lugar: llega a la bandeja del equipo (y al dueño, si tiene).
 * Funciona con o sin sesión (sin sesión, con tope por IP en el servidor).
 */
export function SuggestCorrection({ placeId, placeName }: { placeId: string; placeName: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<CorrectionCategory | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteRequired = category !== '' && NOTE_REQUIRED.includes(category)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await suggestCorrection(new FormData(e.currentTarget))
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    toast.success('¡Gracias! Revisaremos tu sugerencia.')
    setOpen(false)
    setCategory('')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`min-h-11 ${linkBtn}`}>
        <Flag size={15} strokeWidth={1.75} /> ¿Algo está mal? Sugerir una corrección
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="relative max-w-xl space-y-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <Honeypot />
      <input type="hidden" name="place_id" value={placeId} />
      <input type="hidden" name="page" value={pathname} />
      <fieldset>
        <legend className={labelClass}>¿Qué está mal en {placeName}?</legend>
        <div className="mt-2 space-y-1">
          {CORRECTION_CATEGORIES.map((c) => (
            <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-fg hover:bg-surface">
              <input type="radio" name="category" value={c} required checked={category === c}
                onChange={() => setCategory(c)} className="h-4 w-4 accent-goospe-green" />
              {CORRECTION_LABELS[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="correction_message" className={labelClass}>
          Cuéntanos más {!noteRequired && <span className="font-normal text-muted">(opcional)</span>}
        </label>
        <textarea id="correction_message" name="message" rows={3} maxLength={MESSAGE_MAX} required={noteRequired}
          placeholder="Ej: los domingos abre a las 12, no a las 10." className={fieldClass} />
        <p className={`mt-1 ${hintClass}`}>Lo revisa el equipo de Goospe antes de cambiar nada.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enviando…' : 'Enviar sugerencia'}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null) }} className={ghostBtn}>Cancelar</button>
      </div>
    </form>
  )
}
