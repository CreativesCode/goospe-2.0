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

export function track(
  kind: InteractionKind,
  payload: { placeId?: string; eventId?: string; context?: Record<string, unknown> } = {}
) {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      kind,
      place_id: payload.placeId ?? null,
      event_id: payload.eventId ?? null,
      context: payload.context ?? null,
      anon_id: anonId(),
    })
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
