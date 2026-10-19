'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Star, AlertTriangle, Ticket, BadgeCheck, XCircle, MessageSquare, CalendarX, CalendarClock, Inbox, Heart, ImageIcon, ImageOff, EyeOff, MessageCircle, MapPinned, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/shared/components/toast'
import { safeInternalLink, timeAgo } from '@/features/notifications/format'

export type Notif = { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }

const HISTORY = 30
const COLS = 'id, kind, title, body, link, read, created_at'
const LEGACY_COLS = 'id, kind, title, body, read, created_at' // antes de la migración 0037 (sin `link`)

// Icono por tipo. Los avisos críticos / de rechazo llevan además color de alerta.
const ICON: Record<string, LucideIcon> = {
  event_reminder: CalendarClock, review_new: Star, review_critical: AlertTriangle, event_rsvp: Ticket,
  claim_approved: BadgeCheck, claim_rejected: XCircle, review_reply: MessageSquare,
  event_cancelled: CalendarX, event_updated: CalendarClock,
  claim_new: Inbox, change_request_new: Inbox, change_request_resolved: BadgeCheck,
  place_proposal_new: Inbox, place_proposal_resolved: BadgeCheck,
  saved_place_event: Heart, photo_approved: ImageIcon, photo_rejected: ImageOff, review_blocked: EyeOff,
  feedback_new: MessageCircle, feedback_resolved: BadgeCheck, place_correction: MapPinned,
}
const ALERT_KINDS = new Set(['review_critical', 'claim_rejected', 'event_cancelled', 'photo_rejected', 'review_blocked'])

// ── Store-singleton de notificaciones ───────────────────────────────────────────────────────
// El estado y el canal Realtime viven en el módulo: `ensure(userId)` es idempotente para el
// mismo usuario (no re-suscribe al navegar) y reacciona a login/logout.
let items: Notif[] = []
const listeners = new Set<() => void>()
let activeUserId: string | null | undefined = undefined // undefined = aún sin resolver
let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

const emit = () => listeners.forEach((l) => l())
const setItems = (next: Notif[]) => { items = next; emit() }

async function fetchHistory(userId: string) {
  const sb = createClient()
  const query = (cols: string) =>
    sb.from('notifications').select(cols).order('created_at', { ascending: false }).limit(HISTORY)
  let { data, error } = await query(COLS)
  if (error) ({ data, error } = await query(LEGACY_COLS))
  if (activeUserId === userId) setItems(((data ?? []) as unknown as Notif[]).map((n) => ({ ...n, link: n.link ?? null })))
}

function ensure(userId: string | null) {
  if (typeof window === 'undefined' || userId === activeUserId) return // idempotente
  const sb = createClient()
  if (channel) { sb.removeChannel(channel); channel = null } // teardown del usuario anterior
  activeUserId = userId
  setItems([])
  if (!userId) return
  void fetchHistory(userId)

  // Canal único por usuario; vive lo que vive la pestaña (no se re-suscribe al navegar).
  const topic = `notif-${userId}-${Math.random().toString(36).slice(2)}`
  channel = sb
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as Notif
        setItems([{ ...n, link: n.link ?? null }, ...items].slice(0, HISTORY))
        toast.info(n.body ? `${n.title} · ${n.body}` : n.title) // aviso en vivo vía toast global
      }
    )
    .subscribe()
}

// Marca como leídas en el store (optimista) y en la BD (el usuario solo puede tocar `read`).
export async function markRead(ids: string[]) {
  if (!ids.length) return
  const set = new Set(ids)
  setItems(items.map((n) => (set.has(n.id) ? { ...n, read: true } : n)))
  // `as never`: workaround del tipado del cliente de navegador (igual que en use-feed.ts).
  await createClient().from('notifications').update({ read: true } as never).in('id', ids)
}

/** Marca como leídas TODAS las del usuario (también las que no están cargadas en la campana). */
export async function markAllRead() {
  setItems(items.map((n) => (n.read ? n : { ...n, read: true })))
  // La RLS limita el UPDATE a las filas propias; el filtro evita reescribir las ya leídas.
  await createClient().from('notifications').update({ read: true } as never).eq('read', false)
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const getSnapshot = () => items
const EMPTY: Notif[] = []

export function NotificationRow({ n, onOpen }: { n: Notif; onOpen: (n: Notif) => void }) {
  const Icon = ICON[n.kind] ?? Bell
  const alert = ALERT_KINDS.has(n.kind)
  return (
    <li className="border-b border-line last:border-0">
      <button type="button" role="menuitem" onClick={() => onOpen(n)}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface ${n.read ? '' : 'bg-tint'}`}>
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${alert ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-tint text-ink'}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm text-fg ${n.read ? '' : 'font-medium'}`}>{n.title}</span>
          {n.body && <span className="line-clamp-2 block text-xs text-fg-soft [overflow-wrap:anywhere]">{n.body}</span>}
          <span className="mt-0.5 block text-[11px] text-muted">{timeAgo(n.created_at)}</span>
        </span>
        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-goospe-green" aria-label="Sin leer" />}
      </button>
    </li>
  )
}

// Campana de notificaciones en vivo con historial. Lee del store compartido.
export function Notifications({ className = '' }: { className?: string } = {}) {
  const { user } = useAuth()
  const router = useRouter()
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

  const unread = list.filter((n) => !n.read)

  // Abrir una notificación: la marca como leída y navega a su destino (solo rutas internas).
  function openItem(n: Notif) {
    if (!n.read) void markRead([n.id])
    const href = safeInternalLink(n.link)
    if (!href) return
    setOpen(false)
    router.push(href)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        aria-label={unread.length ? `Notificaciones: ${unread.length} sin leer` : 'Notificaciones'}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg-soft transition hover:text-fg md:h-[38px] md:w-[38px] ${className}`}>
        <Bell size={17} strokeWidth={1.75} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-goospe-green px-1 text-[10px] font-medium text-on-brand">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        // z-50: por encima de los chips del feed móvil y del contenido de la página.
        <div role="menu" aria-label="Notificaciones"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-line max-sm:fixed max-sm:inset-x-4 max-sm:top-[calc(var(--sat)+4rem)] max-sm:w-auto">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="text-sm font-medium text-fg">Notificaciones</span>
            {unread.length > 0 && (
              <button type="button" onClick={() => markRead(unread.map((n) => n.id))} className="text-xs font-medium text-ink hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nada por ahora.</p>
          ) : (
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
              {list.map((n) => <NotificationRow key={n.id} n={n} onOpen={openItem} />)}
            </ul>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-ink hover:underline">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
