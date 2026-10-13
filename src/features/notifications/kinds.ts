// Lógica pura de las notificaciones in-app: grupos que el usuario puede silenciar, clave de
// agrupación del aviso de "lugar guardado" y paginación del historial.

/** Grupos silenciables (notification_preferences.muted). Hoy solo los avisos de lugares guardados. */
export const MUTE_GROUPS = ['saved_places'] as const
export type MuteGroup = (typeof MUTE_GROUPS)[number]

export const MUTE_GROUP_LABELS: Record<MuteGroup, { title: string; hint: string }> = {
  saved_places: {
    title: 'Lugares guardados',
    hint: 'Te avisamos cuando un lugar que guardaste publica un evento (máximo un aviso por lugar al día).',
  },
}

export const isMuteGroup = (v: unknown): v is MuteGroup => (MUTE_GROUPS as readonly unknown[]).includes(v)

/** Limpia lo que venga de la BD o de un formulario: solo grupos conocidos, sin repetir. */
export function normalizeMuted(v: unknown): MuteGroup[] {
  if (!Array.isArray(v)) return []
  return MUTE_GROUPS.filter((g) => v.includes(g))
}

/** Lista nueva de silenciados al activar o desactivar un grupo. */
export function toggleMuted(current: unknown, group: MuteGroup, muted: boolean): MuteGroup[] {
  const set = new Set(normalizeMuted(current))
  if (muted) set.add(group)
  else set.delete(group)
  return MUTE_GROUPS.filter((g) => set.has(g))
}

/**
 * Clave de agrupación del aviso "un lugar que guardaste publicó un evento". Lleva el lugar y
 * el día (UTC): con el índice único (user_id, dedupe_key) de notifications, cada persona recibe
 * como máximo UN aviso por lugar y por día aunque el lugar publique varios eventos, y un
 * reintento de la misma acción no lo duplica.
 */
export function savedEventDedupeKey(placeId: string, at: Date = new Date()): string {
  return `saved_event:${placeId}:${at.toISOString().slice(0, 10)}`
}

export const NOTIFICATIONS_PAGE_SIZE = 20
const MAX_PAGE = 500

/** Página pedida (1..MAX_PAGE) y su rango para `.range(from, to)`. */
export function pageRange(raw: unknown, size: number = NOTIFICATIONS_PAGE_SIZE): { page: number; from: number; to: number } {
  const n = typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? Number(raw) : 1
  const page = Math.min(Math.max(n, 1), MAX_PAGE)
  return { page, from: (page - 1) * size, to: page * size - 1 }
}

export const totalPages = (count: number | null | undefined, size: number = NOTIFICATIONS_PAGE_SIZE) =>
  Math.max(1, Math.ceil((count ?? 0) / size))
