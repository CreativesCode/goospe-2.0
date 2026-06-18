/**
 * Mapas centralizados emoji/categoría → icono Lucide.
 * Única fuente de iconografía de la app (ver docs/10-rediseno-implementacion.md §4).
 * Evita repartir switches de iconos por toda la UI.
 */
import {
  Utensils,
  Coffee,
  Martini,
  Moon,
  Ticket,
  Flower2,
  Heart,
  PartyPopper,
  Users,
  Monitor,
  Trees,
  MapPin,
  Music,
  Store,
  type LucideIcon,
} from 'lucide-react'

/** Gustos del onboarding (qué te gusta hacer). */
export const LIKE_ICON: Record<string, LucideIcon> = {
  comer: Utensils,
  cafe: Coffee,
  beber: Martini,
  noche: Moon,
  eventos: Ticket,
}

/** Ambientes del onboarding / ficha. */
export const VIBE_ICON: Record<string, LucideIcon> = {
  tranquilo: Flower2,
  'romántico': Heart,
  romantico: Heart,
  carrete: PartyPopper,
  familiar: Users,
  'para trabajar': Monitor,
  'al aire libre': Trees,
}

/**
 * Fallback para categorías que llegan de la BD con un emoji.
 * Mapea el emoji guardado a un icono Lucide; default genérico = Store/MapPin.
 */
const EMOJI_CATEGORY: Record<string, LucideIcon> = {
  '🍽️': Utensils,
  '🍽': Utensils,
  '☕': Coffee,
  '🍸': Martini,
  '🍷': Martini,
  '🎵': Music,
  '🎫': Ticket,
  '🌲': Trees,
  '📍': MapPin,
}

export function categoryIcon(emoji?: string | null): LucideIcon {
  if (emoji && EMOJI_CATEGORY[emoji]) return EMOJI_CATEGORY[emoji]
  return Store
}

/** Etiquetas legibles de gustos del onboarding (likes + vibes), para la página de Perfil. */
const TASTE_LABEL: Record<string, string> = {
  comer: 'Comer',
  cafe: 'Café',
  beber: 'Bares',
  noche: 'Salir de noche',
  eventos: 'Eventos',
  tranquilo: 'Tranquilo',
  'romántico': 'Romántico',
  romantico: 'Romántico',
  carrete: 'Carrete',
  familiar: 'Familiar',
  'para trabajar': 'Para trabajar',
  'al aire libre': 'Al aire libre',
}

/** Resuelve un slug de gusto a { label, icon } (busca en likes y vibes). */
export function taste(slug: string): { label: string; icon: LucideIcon | undefined } {
  return { label: TASTE_LABEL[slug] ?? slug, icon: LIKE_ICON[slug] ?? VIBE_ICON[slug] }
}
