'use client'

import { useState } from 'react'
import { joinWaitlist } from '@/actions/waitlist'

type Status = 'idle' | 'sending' | 'done' | 'error'

// Formulario de waitlist para usuarios fuera de cobertura. Adjunta las coords detectadas
// (si las hay) para priorizar qué zona cargar siguiente.
export function WaitlistForm({ coords }: { coords?: { lat: number; lng: number } }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const res = await joinWaitlist({ email, lat: coords?.lat, lng: coords?.lng })
    if ('success' in res) {
      setStatus('done')
    } else {
      setStatus('error')
      setError(res.error)
    }
  }

  if (status === 'done') {
    return (
      <p className="rounded-2xl bg-white/15 px-5 py-4 text-sm text-white ring-1 ring-white/25 backdrop-blur">
        ¡Listo! Te avisamos apenas Goospe llegue a tu zona. 🎉
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        aria-label="Tu correo"
        className="w-full rounded-full bg-white/95 px-5 py-3 text-center text-fg outline-none ring-1 ring-white/30 placeholder:text-muted focus:ring-2 focus:ring-white"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-white px-6 py-3 font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90 disabled:opacity-70"
      >
        {status === 'sending' ? 'Enviando…' : 'Avísame cuando llegue'}
      </button>
      {status === 'error' && <p className="text-sm text-white/90">{error}</p>}
    </form>
  )
}
