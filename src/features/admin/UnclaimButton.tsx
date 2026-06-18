'use client'

import { useState, useTransition } from 'react'
import { Unlink } from 'lucide-react'
import { unclaimPlace } from '@/actions/admin-claims'

/** Rompe la relación de un lugar reclamado con su dueño (sin borrar el lugar). */
export function UnclaimButton({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function run() {
    const fd = new FormData()
    fd.set('place_id', placeId)
    startTransition(() => { void unclaimPlace(fd) })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-muted">¿Liberar «{placeName}»?</span>
        <button onClick={run} disabled={pending} className="rounded-full bg-red-600 px-2.5 py-1 font-medium text-white disabled:opacity-50">
          {pending ? '…' : 'Sí, liberar'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={pending} className="rounded-full border border-line px-2.5 py-1 text-fg-soft">Cancelar</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-soft transition hover:border-red-300 hover:text-red-600">
      <Unlink size={13} /> Des-reclamar
    </button>
  )
}
