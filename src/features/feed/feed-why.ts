import { fmtEta } from './feed-format'
import type { FeedItem } from './use-feed'

/** "a", "a y b", "a, b y c". */
const joinEs = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`

/**
 * Frase "por qué te lo sugerimos" del panel lateral del feed. Se arma solo con datos reales
 * del lugar (cercanía, valoración, precio y etiquetas): no se llama a ninguna IA por tarjeta.
 */
export function buildWhy(p: Pick<FeedItem, 'distance_m' | 'rating' | 'reviews_count' | 'price_level' | 'tags'>): string {
  const parts = [`está a ${fmtEta(p.distance_m)}`]
  if (p.rating >= 4 && p.reviews_count > 0) parts.push(`tiene ${Number(p.rating).toFixed(1)} de valoración`)
  if (p.price_level === 1) parts.push('es económico')
  const tags = (p.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 2)
  if (tags.length) parts.push(`destaca por ${tags.join(' y ')}`)
  const text = joinEs(parts)
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}
