import type { PanelPlace } from '@/features/business/panel-data'
import type { PanelTab } from '@/features/business/panel-tabs'

// "Completa tu ficha": qué datos de la ficha ya están y cuáles faltan. Lógica pura, calculada
// solo con campos reales del lugar; cada pendiente apunta a la sección donde se completa.
export type ChecklistItem = { key: string; label: string; done: boolean; tab: PanelTab }

const has = (s: string | null | undefined) => !!s?.trim()

export function listingChecklist(place: PanelPlace): ChecklistItem[] {
  const contact = [place.phone, place.whatsapp, place.email, place.website, place.instagram].some(has)
  return [
    { key: 'description', label: 'Descripción y frase del lugar', done: has(place.description) && has(place.vibe_line), tab: 'ficha' },
    { key: 'hours', label: 'Horario por día', done: has(place.hours?.osm_raw), tab: 'ficha' },
    { key: 'contact', label: 'Datos de contacto', done: contact, tab: 'ficha' },
    { key: 'price', label: 'Precio y etiquetas', done: place.price_level != null && (place.tags?.length ?? 0) > 0, tab: 'ficha' },
    { key: 'media', label: 'Subir portada y logo', done: has(place.cover_url) && has(place.logo_url), tab: 'fotos' },
    { key: 'menu', label: 'Carta con foto (IA)', done: !!place.menu, tab: 'carta' },
  ]
}

/** Porcentaje de la ficha completado (0–100). */
export function completionPct(items: ChecklistItem[]): number {
  if (!items.length) return 0
  return Math.round((items.filter((i) => i.done).length / items.length) * 100)
}
