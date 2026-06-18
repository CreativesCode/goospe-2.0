'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setReviewStatus, setEventStatus } from '@/actions/moderation'

// Botones de moderación reactiva: ocultar (block/reject) o restaurar (approve).
export function ModStatusButtons({
  type, id, status,
}: {
  type: 'review' | 'event'; id: string; status: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const hidden = type === 'review' ? status === 'blocked' : status === 'rejected'

  async function set(next: string) {
    setBusy(true)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', next)
    const res = type === 'review' ? await setReviewStatus(fd) : await setEventStatus(fd)
    setBusy(false)
    if (res?.error) { alert(res.error); return }
    router.refresh()
  }

  const hideValue = type === 'review' ? 'blocked' : 'rejected'

  return hidden ? (
    <button onClick={() => set('approved')} disabled={busy}
      className="rounded-full bg-goospe-green px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
      Restaurar
    </button>
  ) : (
    <button onClick={() => set(hideValue)} disabled={busy}
      className="rounded-full border border-red-400/50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-60">
      Ocultar
    </button>
  )
}
