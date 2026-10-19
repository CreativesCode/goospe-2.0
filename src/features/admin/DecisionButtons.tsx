'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { toast } from '@/shared/components/toast'

type Action = (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
const REASON_MIN = 5
const REASON_MAX = 500

/**
 * Aprobar / rechazar una solicitud de la cola del admin. Rechazar exige escribir un MOTIVO, que
 * se guarda y se le muestra al solicitante. `children` = campos extra que viajan al aprobar.
 */
export function DecisionButtons({ idField, id, approve, reject, approvedMessage, children }: {
  idField: string
  id: string
  approve: Action
  reject: Action
  approvedMessage: string
  children?: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  function run(action: Action, fd: FormData, okMessage: string) {
    fd.set(idField, id)
    startTransition(async () => {
      const res = await action(fd)
      if (res?.error) { toast.error(res.error); return }
      toast.success(okMessage)
      setRejecting(false)
      router.refresh()
    })
  }

  if (rejecting) {
    const tooShort = reason.trim().length < REASON_MIN
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(); fd.set('reason', reason); run(reject, fd, 'Solicitud rechazada') }}
        className="w-full space-y-2 sm:w-72"
      >
        <label className="block text-xs font-medium text-fg-soft">
          Motivo del rechazo (lo verá el solicitante)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required maxLength={REASON_MAX} autoFocus
            placeholder="Ej: no pudimos confirmar por teléfono que el negocio es tuyo."
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-goospe-green" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending || tooShort} className="min-h-10 rounded-full bg-red-600 px-4 text-xs font-medium text-white disabled:opacity-50">
            {pending ? 'Rechazando…' : 'Confirmar rechazo'}
          </button>
          <button type="button" onClick={() => setRejecting(false)} disabled={pending} className="min-h-10 rounded-full border border-line px-4 text-xs text-fg-soft">Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(approve, new FormData(e.currentTarget), approvedMessage) }}
      className="flex flex-col items-stretch gap-2 sm:items-end"
    >
      {children}
      <div className="inline-flex items-center gap-2">
        <button type="submit" disabled={pending}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-goospe-green px-4 text-xs font-medium text-on-brand transition hover:brightness-105 disabled:opacity-50">
          <Check size={13} strokeWidth={2} /> {pending ? 'Guardando…' : 'Aprobar'}
        </button>
        <button type="button" onClick={() => setRejecting(true)} disabled={pending}
          className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-4 text-xs font-medium text-fg-soft transition hover:border-red-300 hover:text-red-600">
          <X size={13} strokeWidth={2} /> Rechazar
        </button>
      </div>
    </form>
  )
}
