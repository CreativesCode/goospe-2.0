'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { submitFeedback } from '@/actions/feedback'
import { cardClass, fieldClass, ghostBtn, hintClass, labelClass, primaryBtn } from '@/features/business/ui'
import { GENERAL_CATEGORIES, GENERAL_LABELS, MESSAGE_MAX, MESSAGE_MIN, type GeneralCategory } from '@/features/feedback/feedback-schema'

/** Campo trampa para bots: fuera de pantalla y fuera del orden de tabulación. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>No rellenes este campo<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
    </div>
  )
}

/**
 * Feedback general. `signedIn` oculta el email de contacto (ya sabemos quién escribe);
 * `from` es la página desde la que se llegó, para reproducir un fallo.
 */
export function FeedbackForm({ signedIn, initialCategory, from }: {
  signedIn: boolean; initialCategory: GeneralCategory | null; from: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // onSubmit + FormData: un error del servidor no borra lo escrito.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await submitFeedback(new FormData(e.currentTarget))
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div role="status" className={`text-center ${cardClass}`}>
        <CheckCircle2 size={36} strokeWidth={1.5} className="mx-auto text-ink" />
        <p className="mt-3 text-lg font-medium text-fg">¡Gracias! Recibimos tu mensaje</p>
        <p className="mt-1 text-sm text-fg-soft">Lo lee una persona del equipo.{signedIn ? ' Si lo resolvemos, te avisamos en tus notificaciones.' : ''}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/feed" className={primaryBtn}>Volver al feed</Link>
          <button type="button" onClick={() => setSent(false)} className={ghostBtn}>Enviar otro</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={`relative space-y-4 ${cardClass}`}>
      <Honeypot />
      {from && <input type="hidden" name="page" value={from} />}
      <div>
        <label htmlFor="category" className={labelClass}>¿De qué se trata?</label>
        <select id="category" name="category" required defaultValue={initialCategory ?? ''} className={fieldClass}>
          <option value="" disabled>Elige una opción</option>
          {GENERAL_CATEGORIES.map((c) => <option key={c} value={c}>{GENERAL_LABELS[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="message" className={labelClass}>Tu mensaje</label>
        <textarea id="message" name="message" required rows={5} minLength={MESSAGE_MIN} maxLength={MESSAGE_MAX}
          placeholder="Cuéntanos qué pasó o qué te gustaría ver." className={fieldClass} />
      </div>
      {!signedIn && (
        <div>
          <label htmlFor="contact_email" className={labelClass}>Tu email <span className="font-normal text-muted">(opcional)</span></label>
          <input id="contact_email" name="contact_email" type="email" autoComplete="email" inputMode="email"
            autoCapitalize="none" spellCheck={false} className={fieldClass} />
          <p className={`mt-1 ${hintClass}`}>Solo si quieres que te respondamos.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enviando…' : 'Enviar'}</button>
    </form>
  )
}
