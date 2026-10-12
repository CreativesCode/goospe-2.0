// Categorías de email. Módulo puro (sin 'server-only'): lo usan el servidor, el panel y los tests.
//
// · transactional: respuesta a algo que la persona hizo (reclamo, solicitud de cambio). No tiene
//   baja ni cabecera List-Unsubscribe y no consulta preferencias.
// · el resto: se puede dar de baja por categoría (tabla email_preferences; sin fila = suscrito).
export const SUBSCRIBABLE_CATEGORIES = ['weekly_report', 'digest', 'alerts', 'events'] as const
export type SubscribableCategory = (typeof SUBSCRIBABLE_CATEGORIES)[number]
export type EmailCategory = SubscribableCategory | 'transactional'

export const CATEGORY_LABELS: Record<SubscribableCategory, { title: string; hint: string }> = {
  weekly_report: { title: 'Informe semanal', hint: 'Cada lunes, el resumen de tu semana escrito por la IA.' },
  digest: { title: 'Resumen de números', hint: 'Tus cifras de la semana, sin texto de IA.' },
  alerts: { title: 'Alertas de reseñas', hint: 'Aviso cuando alguien deja una reseña de 1 o 2 estrellas.' },
  events: { title: 'Cambios en eventos', hint: 'Si cancelan o mueven un evento al que te apuntaste.' },
}

/** Las que tienen sentido para quien administra un negocio (el panel solo muestra estas). */
export const OWNER_CATEGORIES: readonly SubscribableCategory[] = ['weekly_report', 'digest', 'alerts']

export const isSubscribableCategory = (v: unknown): v is SubscribableCategory =>
  typeof v === 'string' && (SUBSCRIBABLE_CATEGORIES as readonly string[]).includes(v)

export type PreferenceRow = { category: string; subscribed: boolean }

/** Sin fila = suscrito. Lo transaccional siempre se envía. */
export function isSubscribed(rows: readonly PreferenceRow[], category: EmailCategory): boolean {
  if (category === 'transactional') return true
  const row = rows.find((r) => r.category === category)
  return row ? row.subscribed : true
}

export type SendDecision = 'send' | 'skipped_unsubscribed' | 'skipped_no_provider' | 'failed_no_link_secret'

/**
 * Qué hacer con un envío, en orden: la baja manda (no se registra como "sin proveedor" algo
 * que igual no se habría enviado); sin proveedor se omite; y un email con baja no sale si no
 * se puede firmar su enlace de baja (EMAIL_LINK_SECRET): se falla cerrado.
 */
export function decideSend(i: {
  category: EmailCategory; subscribed: boolean; hasProvider: boolean; hasLinkSecret: boolean
}): SendDecision {
  if (i.category !== 'transactional' && !i.subscribed) return 'skipped_unsubscribed'
  if (!i.hasProvider) return 'skipped_no_provider'
  if (i.category !== 'transactional' && !i.hasLinkSecret) return 'failed_no_link_secret'
  return 'send'
}
