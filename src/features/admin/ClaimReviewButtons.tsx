'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { approveClaim, rejectClaim } from '@/actions/admin-claims'
import { toast } from '@/shared/components/toast'

/** Aprobar / rechazar una solicitud de reclamo pendiente desde la cola de moderación. */
export function ClaimReviewButtons({ claimId, placeName }: { claimId: string; placeName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmReject, setConfirmReject] = useState(false)

  function approve() {
    const fd = new FormData(); fd.set('claim_id', claimId)
    startTransition(async () => {
      const res = await approveClaim(fd)
      if (res?.error) { toast.error(res.error); return }
      toast.success(`«${placeName}» aprobado`)
      router.refresh()
    })
  }

  function reject() {
    const fd = new FormData(); fd.set('claim_id', claimId)
    startTransition(async () => {
      const res = await rejectClaim(fd)
      if (res?.error) { toast.error(res.error); return }
      toast.success('Solicitud rechazada')
      setConfirmReject(false)
      router.refresh()
    })
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={approve} disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-goospe-green px-3 py-1 text-xs font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-50">
        <Check size={13} strokeWidth={2} /> Aprobar
      </button>
      {confirmReject ? (
        <>
          <button onClick={reject} disabled={pending} className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {pending ? '…' : 'Confirmar'}
          </button>
          <button onClick={() => setConfirmReject(false)} disabled={pending} className="rounded-full border border-line px-3 py-1 text-xs text-fg-soft">Cancelar</button>
        </>
      ) : (
        <button onClick={() => setConfirmReject(true)} disabled={pending}
          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-medium text-fg-soft transition hover:border-red-300 hover:text-red-600">
          <X size={13} strokeWidth={2} /> Rechazar
        </button>
      )}
    </div>
  )
}
