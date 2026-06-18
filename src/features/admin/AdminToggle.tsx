'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { setUserAdmin } from '@/actions/admin-users'

/** Marca/desmarca admin a un usuario, con confirmación inline. */
export function AdminToggle({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    const fd = new FormData()
    fd.set('user_id', userId)
    fd.set('next', String(!isAdmin))
    startTransition(async () => {
      const res = await setUserAdmin(fd)
      if (res?.error) { setErr(res.error); setConfirming(false) }
      else setConfirming(false)
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <button onClick={run} disabled={pending} className="rounded-full bg-goospe-green px-2.5 py-1 font-medium text-white disabled:opacity-50">
          {pending ? '…' : isAdmin ? 'Quitar admin' : 'Hacer admin'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={pending} className="rounded-full border border-line px-2.5 py-1 text-fg-soft">Cancelar</button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={() => { setErr(null); setConfirming(true) }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
          isAdmin ? 'border-line bg-surface text-fg-soft hover:text-red-600' : 'border-line bg-surface text-fg-soft hover:text-goospe-green-dark'
        }`}>
        {isAdmin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
        {isAdmin ? 'Quitar admin' : 'Hacer admin'}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  )
}
