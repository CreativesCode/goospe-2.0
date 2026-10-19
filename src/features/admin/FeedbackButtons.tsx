'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { resolveFeedback } from '@/actions/admin-feedback'
import { toast } from '@/shared/components/toast'
import { ADMIN_NOTE_MAX } from '@/features/feedback/feedback-schema'

/**
 * Un mensaje ABIERTO de la bandeja (fila + botones). Al resolverlo o descartarlo desaparece al
 * instante: el refresco del servidor tarda unos segundos en llegar y, mientras tanto, la fila
 * seguía ahí con sus botones activos (mismo arreglo que `OwnPhotos` en PlaceMedia).
 */
export function FeedbackOpenItem({ feedbackId, children }: { feedbackId: string; children: ReactNode }) {
  const [closed, setClosed] = useState(false)
  if (closed) return null
  return (
    <li className="rounded-2xl border border-amber-300/50 bg-amber-500/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">{children}</div>
        <FeedbackButtons feedbackId={feedbackId} onDone={() => setClosed(true)} />
      </div>
    </li>
  )
}

/** Resolver / descartar un mensaje de la bandeja de feedback, con nota interna opcional. */
export function FeedbackButtons({ feedbackId, onDone }: { feedbackId: string; onDone?: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')

  function run(decision: 'resolved' | 'dismissed') {
    const fd = new FormData()
    fd.set('feedback_id', feedbackId)
    fd.set('decision', decision)
    fd.set('note', note)
    startTransition(async () => {
      const res = await resolveFeedback(fd)
      if (res?.error) { toast.error(res.error); return }
      toast.success(decision === 'resolved' ? 'Marcado como resuelto' : 'Descartado')
      onDone?.()
      router.refresh()
    })
  }

  return (
    <div className="w-full space-y-2 sm:w-64">
      <label className="block text-xs font-medium text-fg-soft">
        Nota interna (opcional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={ADMIN_NOTE_MAX}
          placeholder="Qué se hizo o por qué se descarta"
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-goospe-green" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => run('resolved')} disabled={pending}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-goospe-green px-4 text-xs font-medium text-on-brand transition hover:brightness-105 disabled:opacity-50">
          <Check size={13} strokeWidth={2} /> Resuelto
        </button>
        <button type="button" onClick={() => run('dismissed')} disabled={pending}
          className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-4 text-xs font-medium text-fg-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
          <X size={13} strokeWidth={2} /> Descartar
        </button>
      </div>
    </div>
  )
}
