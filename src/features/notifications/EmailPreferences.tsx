'use client'

import { useState } from 'react'
import { Mail, MailX } from 'lucide-react'
import { setSubscriptionByToken, updateEmailPreference } from '@/actions/email-preferences'
import { CATEGORY_LABELS, type SubscribableCategory } from '@/lib/email/categories'
import { toast } from '@/shared/components/toast'
import { cardClass, ghostBtn, hintClass, primaryBtn, sectionTitle } from '@/features/business/ui'

/** Interruptores de email del dueño en "Mis lugares" (usuario en sesión). */
export function EmailPreferences({ categories, initial }: {
  categories: readonly SubscribableCategory[]; initial: Record<SubscribableCategory, boolean>
}) {
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState<SubscribableCategory | null>(null)

  async function toggle(category: SubscribableCategory) {
    const next = !state[category]
    const fd = new FormData()
    fd.set('category', category)
    fd.set('subscribed', next ? '1' : '0')
    setBusy(category)
    const res = await updateEmailPreference(fd)
    setBusy(null)
    if (res?.error) { toast.error(res.error); return }
    setState((s) => ({ ...s, [category]: next }))
    toast.success(next ? 'Te lo volveremos a enviar' : 'Ya no te lo enviaremos')
  }

  return (
    <section id="emails" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={sectionTitle}>Emails de Goospe</h2>
      <p className={`mb-3 ${hintClass}`}>Elige qué te mandamos por correo. Los avisos sobre tus reclamos y solicitudes llegan siempre.</p>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p id={`email-${c}`} className="text-sm font-medium text-fg">{CATEGORY_LABELS[c].title}</p>
              <p className={hintClass}>{CATEGORY_LABELS[c].hint}</p>
            </div>
            <button
              type="button" role="switch" aria-checked={state[c]} aria-labelledby={`email-${c}`}
              disabled={busy === c} onClick={() => toggle(c)}
              className={`relative inline-flex h-11 w-14 shrink-0 items-center disabled:opacity-60`}
            >
              <span className={`h-7 w-12 rounded-full transition ${state[c] ? 'bg-goospe-green' : 'bg-line'}`} />
              <span className={`absolute left-1 h-5 w-5 rounded-full bg-white shadow transition ${state[c] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Tarjeta de la página pública /unsubscribe: confirma la baja y permite volver a suscribirse. */
export function UnsubscribeCard({ token, category, subscribed: initial }: {
  token: string; category: SubscribableCategory; subscribed: boolean
}) {
  const [subscribed, setSubscribed] = useState(initial)
  const [changed, setChanged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { title } = CATEGORY_LABELS[category]

  async function apply(next: boolean) {
    const fd = new FormData()
    fd.set('token', token)
    fd.set('subscribed', next ? '1' : '0')
    setBusy(true); setError(null)
    const res = await setSubscriptionByToken(fd)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setSubscribed(next)
    setChanged(true)
  }

  const Icon = subscribed ? Mail : MailX
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
        <Icon size={30} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-medium text-fg">
        {subscribed ? (changed ? '¡Listo, sigues suscrito!' : `¿Dejar de recibir “${title}”?`) : 'Listo, te dimos de baja'}
      </h1>
      <p role="status" className="text-fg-soft">
        {subscribed
          ? `Seguirás recibiendo “${title}” en tu correo.`
          : `Ya no te enviaremos “${title}”. Si fue un error, puedes volver a suscribirte aquí mismo.`}
      </p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {subscribed ? (
        !changed && <button type="button" disabled={busy} onClick={() => apply(false)} className={primaryBtn}>{busy ? 'Guardando…' : 'Sí, darme de baja'}</button>
      ) : (
        <button type="button" disabled={busy} onClick={() => apply(true)} className={ghostBtn}>{busy ? 'Guardando…' : 'Volver a suscribirme'}</button>
      )}
    </div>
  )
}
