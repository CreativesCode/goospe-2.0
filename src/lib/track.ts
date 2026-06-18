'use client'

// Telemetría de comportamiento (tabla `interactions`). Base de la personalización (lado C)
// y de las estadísticas / informe semanal (lado B). Funciona con o sin sesión: el usuario
// autenticado se resuelve en el server por cookie; el anónimo se identifica por un id de
// dispositivo en localStorage.
export type InteractionKind =
  | 'view_card' | 'view_detail' | 'save' | 'unsave' | 'dismiss'
  | 'directions' | 'call' | 'share' | 'rsvp' | 'concierge_pick'

const ANON_KEY = 'goospe:anon'

function anonId(): string | null {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

// Cola en memoria: `view_card` se dispara por cada card vista → en vez de un POST (y un
// round-trip de auth en el server) por evento, los agrupamos y enviamos un lote cada pocos
// segundos. La sesión se resuelve una vez por lote en el server (ver api/track/route.ts).
type QueuedEvent = {
  kind: InteractionKind
  place_id: string | null
  event_id: string | null
  context: Record<string, unknown> | null
  anon_id: string | null
}

const queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false
const FLUSH_MS = 2500
const MAX_BATCH = 20

function send(body: string) {
  try {
    // sendBeacon sobrevive a la navegación y envía cookies same-origin (resuelve la sesión).
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
    }
  } catch {
    /* la telemetría nunca debe romper la UX */
  }
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length) return
  const events = queue.splice(0, queue.length)
  send(JSON.stringify({ events }))
}

function ensureListeners() {
  if (listening || typeof document === 'undefined') return
  listening = true
  // Vaciar antes de que la pestaña se oculte o la página se descargue (no perder eventos
  // al navegar a Maps / tel: / share). sendBeacon es fiable en estos momentos.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', flush)
}

export function track(
  kind: InteractionKind,
  payload: { placeId?: string; eventId?: string; context?: Record<string, unknown> } = {}
) {
  if (typeof window === 'undefined') return
  ensureListeners()
  queue.push({
    kind,
    place_id: payload.placeId ?? null,
    event_id: payload.eventId ?? null,
    context: payload.context ?? null,
    anon_id: anonId(),
  })
  if (queue.length >= MAX_BATCH) { flush(); return }
  if (!timer) timer = setTimeout(flush, FLUSH_MS)
}
