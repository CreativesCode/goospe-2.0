'use client'

import { useSyncExternalStore } from 'react'
import { Check, AlertCircle, Info, X } from 'lucide-react'

/**
 * Sistema de toasts unificado (sin dependencias). Reemplaza `alert()` nativo y los
 * mensajes inline sueltos por feedback consistente y accesible (`aria-live`).
 *
 * API callable desde cualquier parte (incl. handlers fuera de React):
 *   import { toast } from '@/shared/components/toast'
 *   toast.success('Guardado'); toast.error('No se pudo'); toast.info('…')
 *
 * Montar <Toaster /> una sola vez (en el root layout).
 */

type Variant = 'success' | 'error' | 'info'
type ToastAction = { label: string; onClick: () => void }
type ToastOpts = { action?: ToastAction; duration?: number }
type ToastItem = { id: number; message: string; variant: Variant; action?: ToastAction }

let items: ToastItem[] = []
const listeners = new Set<() => void>()
let nextId = 1

const emit = () => listeners.forEach((l) => l())

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(message: string, variant: Variant, opts: ToastOpts = {}) {
  const id = nextId++
  items = [...items, { id, message, variant, action: opts.action }]
  emit()
  // Auto-cierre; los errores duran un poco más para alcanzar a leerlos. Con acción (p. ej.
  // "Deshacer") también se da más tiempo para reaccionar.
  const ttl = opts.duration ?? (variant === 'error' || opts.action ? 6000 : 4000)
  setTimeout(() => dismiss(id), ttl)
  return id
}

export const toast = {
  success: (message: string, opts?: ToastOpts) => push(message, 'success', opts),
  error: (message: string, opts?: ToastOpts) => push(message, 'error', opts),
  info: (message: string, opts?: ToastOpts) => push(message, 'info', opts),
  dismiss,
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = () => items
const EMPTY: ToastItem[] = []

const STYLE: Record<Variant, { icon: typeof Check; accent: string }> = {
  success: { icon: Check, accent: 'text-goospe-green' },
  error: { icon: AlertCircle, accent: 'text-red-500' },
  info: { icon: Info, accent: 'text-fg-soft' },
}

export function Toaster() {
  // getServerSnapshot devuelve un array vacío estable (SSR no tiene toasts).
  const list = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)

  if (list.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      aria-live="polite"
    >
      {list.map((t) => {
        const { icon: Icon, accent } = STYLE[t.variant]
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-sm text-fg shadow-lg"
          >
            <Icon size={18} strokeWidth={2} className={`mt-0.5 shrink-0 ${accent}`} />
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                className="shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold text-goospe-green transition hover:bg-goospe-green/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="-mr-1 shrink-0 rounded p-0.5 text-muted transition hover:text-fg"
              aria-label="Cerrar"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
