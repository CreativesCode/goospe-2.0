'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Send } from 'lucide-react'
import { requestPlaceChange } from '@/actions/owner-requests'
import { toast } from '@/shared/components/toast'
import { ghostBtn, hintClass, inputSm, linkBtn, primaryBtn } from '@/features/business/ui'

type Kind = 'name' | 'location'

const COPY: Record<Kind, { cta: string; title: string; help: string }> = {
  name: {
    cta: 'Pedir cambio de nombre a Goospe',
    title: 'Nuevo nombre',
    help: 'El nombre lo revisa nuestro equipo para evitar suplantaciones. Te avisamos en cuanto se resuelva.',
  },
  location: {
    cta: 'Pedir cambio de ubicación a Goospe',
    title: 'Ubicación correcta',
    help: 'Pega el enlace de Google Maps de tu local o sus coordenadas (lat, lng), o describe dónde está. Nuestro equipo mueve el pin.',
  },
}

/**
 * Lo que el dueño no cambia por sí mismo (nombre y pin del mapa): crea una solicitud que
 * resuelve un admin. Si ya hay una pendiente de ese tipo, solo la muestra.
 */
export function ChangeRequestBox({ placeId, kind, pending }: { placeId: string; kind: Kind; pending: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[kind]

  if (pending) {
    return (
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-soft">
        <Clock size={13} strokeWidth={1.75} className="text-ink" /> Tienes una solicitud de cambio en revisión.
      </p>
    )
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`mt-1 ${linkBtn}`}>{copy.cta}</button>
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation() // vive dentro de la tarjeta de la ficha: no debe enviar otro formulario
    const fd = new FormData(e.currentTarget)
    fd.set('place_id', placeId)
    fd.set('kind', kind)
    setBusy(true); setError(null)
    const res = await requestPlaceChange(fd)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    toast.success('Solicitud enviada. Te avisaremos cuando se resuelva.')
    setOpen(false)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2 rounded-xl border border-goospe-green/30 bg-tint p-3">
      <label className="block text-xs font-medium text-fg-soft">
        {copy.title}
        {kind === 'name'
          ? <input name="name" required maxLength={120} className={`mt-1 ${inputSm}`} />
          : <input name="reference" required maxLength={500} placeholder="https://maps.app.goo.gl/… o -41.3195, -72.9854" className={`mt-1 ${inputSm}`} />}
      </label>
      <label className="block text-xs font-medium text-fg-soft">
        Mensaje para el equipo (opcional)
        <textarea name="message" rows={2} maxLength={1000} className={`mt-1 ${inputSm}`} />
      </label>
      <p className={hintClass}>{copy.help}</p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryBtn}><Send size={15} strokeWidth={1.75} /> {busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className={ghostBtn}>Cancelar</button>
      </div>
    </form>
  )
}
