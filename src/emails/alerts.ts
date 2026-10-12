import { compose, type EmailContent } from '@/emails/layout'

// Avisos que se pueden dar de baja: reseña crítica (al negocio) y cambios en un evento (a
// quienes se apuntaron). Funciones puras: URLs absolutas y fechas ya formateadas por quien llama.

const unsubscribe = (url: string | null, label: string) => (url ? { url, label } : null)

/** Al negocio: alguien dejó una reseña de 1 o 2 estrellas. */
export function criticalReviewEmail(p: {
  placeName: string; rating: number; body: string | null; panelUrl: string; unsubscribeUrl: string | null
}): EmailContent {
  const stars = `${p.rating} de 5`
  return compose({
    subject: `Reseña crítica en ${p.placeName} (${stars})`,
    preheader: 'Responder rápido y con calma suele dar vuelta la impresión.',
    heading: `Te dejaron una reseña de ${stars}`,
    blocks: [
      { type: 'p', text: `Alguien calificó ${p.placeName} con ${stars}.` },
      ...(p.body?.trim() ? [{ type: 'quote' as const, text: p.body }] : []),
      { type: 'p', text: 'Una respuesta pública, breve y amable, le muestra a quien lea tu ficha que te importa. Puedes responderla desde tu panel.' },
    ],
    cta: { label: 'Responder la reseña', url: p.panelUrl },
    unsubscribe: unsubscribe(p.unsubscribeUrl, 'Dejar de recibir alertas de reseñas'),
  })
}

/** A quien se apuntó: el evento fue cancelado. */
export function eventCancelledEmail(p: {
  eventName: string; placeName: string; when: string; reason: string | null; placeUrl: string; unsubscribeUrl: string | null
}): EmailContent {
  return compose({
    subject: `Evento cancelado: ${p.eventName}`,
    preheader: `${p.placeName} canceló el evento del ${p.when} h.`,
    heading: 'Se canceló un evento al que te apuntaste',
    blocks: [
      { type: 'p', text: `${p.placeName} canceló “${p.eventName}”, que era el ${p.when} h.` },
      ...(p.reason?.trim() ? [{ type: 'heading' as const, text: 'Motivo' }, { type: 'quote' as const, text: p.reason }] : []),
    ],
    cta: { label: `Ver ${p.placeName}`, url: p.placeUrl },
    unsubscribe: unsubscribe(p.unsubscribeUrl, 'Dejar de recibir avisos de eventos'),
  })
}

/** A quien se apuntó: el evento cambió de fecha u hora. */
export function eventUpdatedEmail(p: {
  eventName: string; placeName: string; when: string; placeUrl: string; unsubscribeUrl: string | null
}): EmailContent {
  return compose({
    subject: `Cambió la fecha: ${p.eventName}`,
    preheader: `Ahora es el ${p.when} h en ${p.placeName}.`,
    heading: 'Cambió la fecha de un evento al que te apuntaste',
    blocks: [
      { type: 'p', text: `“${p.eventName}” ahora es el ${p.when} h en ${p.placeName}.` },
      { type: 'p', text: 'Si ya no puedes ir, puedes quitar tu asistencia desde la ficha del lugar.' },
    ],
    cta: { label: 'Ver el evento', url: p.placeUrl },
    unsubscribe: unsubscribe(p.unsubscribeUrl, 'Dejar de recibir avisos de eventos'),
  })
}
