'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { moderatePhoto } from '@/actions/photos'

export function ModerationActions({ photoId }: { photoId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function act(decision: 'approve' | 'reject') {
    setBusy(true)
    const fd = new FormData()
    fd.set('photo_id', photoId)
    fd.set('decision', decision)
    const res = await moderatePhoto(fd)
    setBusy(false)
    if (res?.error) { alert(res.error); return }
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => act('approve')} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-goospe-green px-4 py-1.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-60">
        <Check size={15} strokeWidth={2} /> Aprobar
      </button>
      <button onClick={() => act('reject')} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-red-400/50 px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-60">
        <X size={15} strokeWidth={2} /> Rechazar
      </button>
    </div>
  )
}
