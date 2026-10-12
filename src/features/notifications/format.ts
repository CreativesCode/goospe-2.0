// Utilidades puras de la campana de notificaciones.

/** Solo rutas internas ("/algo"): nunca un esquema ni "//host" aunque llegue en la fila. */
export function safeInternalLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null
  return link
}

/** "ahora", "hace 5 min", "hace 3 h", "hace 2 d" o la fecha corta si pasó más de una semana. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.floor((now - t) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d <= 7) return `hace ${d} d`
  return new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
