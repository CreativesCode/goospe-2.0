'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Notif = { id: string; title: string; body: string | null; read: boolean; created_at: string }

// Campana de notificaciones en vivo. Recibe recordatorios de evento (encolados por pg_cron)
// vía Supabase Realtime + un fetch inicial de los no leídos. Reemplaza al push FCM (diferido).
export function Notifications() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Notif | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sb = createClient()
    let channel: ReturnType<typeof sb.channel> | null = null
    let cancelled = false

    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      sb.from('notifications')
        .select('id, title, body, read, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (!cancelled) setItems((data ?? []) as Notif[]) })

      // Nombre de canal único por montaje: evita reusar un canal ya suscrito
      // (el doble-montaje de React en dev provocaba "add callbacks after subscribe()").
      const topic = `notif-${user.id}-${Math.random().toString(36).slice(2)}`
      channel = sb
        .channel(topic)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new as Notif
            setItems((prev) => [n, ...prev])
            setToast(n)
            setTimeout(() => setToast((t) => (t?.id === n.id ? null : t)), 6000)
          }
        )
        .subscribe()
    })

    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => {
      cancelled = true
      document.removeEventListener('mousedown', onClick)
      if (channel) sb.removeChannel(channel)
    }
  }, [])

  const unread = items.filter((n) => !n.read).length

  async function openAndRead() {
    setOpen((v) => !v)
    if (!open && unread > 0) {
      const sb = createClient()
      const ids = items.filter((n) => !n.read).map((n) => n.id)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      await sb.from('notifications').update({ read: true } as never).in('id', ids)
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button onClick={openAndRead} aria-label="Notificaciones"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-fg-soft transition hover:text-fg">
          <Bell size={18} strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-goospe-green px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-line">
            <div className="border-b border-line px-4 py-2.5 text-sm font-medium text-fg">Notificaciones</div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Nada por ahora.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="border-b border-line px-4 py-2.5 last:border-0">
                    <p className="text-sm font-medium text-fg">{n.title}</p>
                    {n.body && <p className="text-xs text-fg-soft">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* toast en vivo */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 flex w-[90%] max-w-sm -translate-x-1/2 items-start gap-2.5 rounded-xl bg-card p-3 shadow-2xl ring-1 ring-line">
          <Bell size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-goospe-green" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{toast.title}</p>
            {toast.body && <p className="text-xs text-fg-soft">{toast.body}</p>}
          </div>
        </div>
      )}
    </>
  )
}
