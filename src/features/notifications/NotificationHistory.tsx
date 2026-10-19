'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { NotificationRow, markAllRead, markRead, type Notif } from '@/features/notifications/Notifications'
import { safeInternalLink } from '@/features/notifications/format'

/**
 * Una página del historial (/notifications). Las filas llegan del servidor; marcar como leída
 * usa las mismas funciones que la campana, así que su contador se actualiza a la vez.
 */
export function NotificationHistory({ initial, unreadTotal }: { initial: Notif[]; unreadTotal: number }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [unread, setUnread] = useState(unreadTotal)
  const [busy, setBusy] = useState(false)

  function open(n: Notif) {
    if (!n.read) {
      void markRead([n.id])
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)))
      setUnread((u) => Math.max(0, u - 1))
    }
    const href = safeInternalLink(n.link) // solo rutas internas, aunque la fila traiga otra cosa
    if (href) router.push(href)
  }

  async function readAll() {
    setBusy(true)
    await markAllRead()
    setRows((prev) => prev.map((r) => ({ ...r, read: true })))
    setUnread(0)
    setBusy(false)
  }

  return (
    <>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm text-fg-soft" role="status">
          {unread > 0 ? `${unread} sin leer` : 'Todo leído'}
        </p>
        {unread > 0 && (
          <button type="button" onClick={readAll} disabled={busy}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink hover:underline disabled:opacity-60">
            <CheckCheck size={16} strokeWidth={1.75} /> Marcar todas como leídas
          </button>
        )}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-card">
        {rows.map((n) => <NotificationRow key={n.id} n={n} onOpen={open} />)}
      </ul>
    </>
  )
}
