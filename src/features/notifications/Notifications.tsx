'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/shared/components/toast'

type Notif = { id: string; title: string; body: string | null; read: boolean; created_at: string }

// ── Store-singleton de notificaciones ───────────────────────────────────────────────────────
// Antes el componente se remontaba en cada navegación → nuevo `getUser()` + fetch + canal
// Realtime por página. Ahora el estado y el canal viven en el módulo: `ensure(userId)` es
// idempotente para el mismo usuario (no re-suscribe al navegar) y reacciona a login/logout.
let items: Notif[] = []
const listeners = new Set<() => void>()
let activeUserId: string | null | undefined = undefined // undefined = aún sin resolver
let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

const emit = () => listeners.forEach((l) => l())
const setItems = (next: Notif[]) => { items = next; emit() }

function ensure(userId: string | null) {
  if (typeof window === 'undefined' || userId === activeUserId) return // idempotente
  const sb = createClient()
  if (channel) { sb.removeChannel(channel); channel = null } // teardown del usuario anterior
  activeUserId = userId
  setItems([])
  if (!userId) return

  sb.from('notifications')
    .select('id, title, body, read, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
    .then(({ data }) => { if (activeUserId === userId) setItems((data ?? []) as Notif[]) })

  // Canal único por usuario; vive lo que vive la pestaña (no se re-suscribe al navegar).
  const topic = `notif-${userId}-${Math.random().toString(36).slice(2)}`
  channel = sb
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as Notif
        setItems([n, ...items])
        toast.info(n.body ? `${n.title} · ${n.body}` : n.title) // aviso en vivo vía toast global
      }
    )
    .subscribe()
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const getSnapshot = () => items
const EMPTY: Notif[] = []

// Campana de notificaciones en vivo. Lee del store compartido; solo el abrir/cerrar es local.
export function Notifications() {
  const { user } = useAuth()
  const list = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // (Re)suscribe al canal según el usuario del store-singleton de auth (idempotente).
  useEffect(() => { ensure(user?.id ?? null) }, [user?.id])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const unread = list.filter((n) => !n.read).length

  async function openAndRead() {
    setOpen((v) => !v)
    if (!open && unread > 0) {
      const sb = createClient()
      const ids = list.filter((n) => !n.read).map((n) => n.id)
      setItems(items.map((n) => ({ ...n, read: true })))
      await sb.from('notifications').update({ read: true } as never).in('id', ids)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={openAndRead} aria-label="Notificaciones" aria-haspopup="menu" aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-fg-soft transition hover:text-fg">
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
          {list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nada por ahora.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {list.map((n) => (
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
  )
}
