import type { PlaceCardData } from '@/features/places/PlaceCard'

/** Columnas de un lugar guardado, tal como las pide /saved y el perfil. */
export const SAVED_PLACE_SELECT =
  'place_id, places(id, slug, name, vibe_line, price_level, cover_url, hours, place_photos(url, status), place_categories(categories(emoji, name)), cities(timezone))'

export type SavedRow = {
  place_id: string
  places: {
    id: string
    slug: string
    name: string
    vibe_line: string | null
    price_level: number | null
    cover_url: string | null
    hours: { osm_raw?: string | null } | null
    place_photos: { url: string; status: string | null }[]
    place_categories: { categories: { emoji: string | null; name: string } | null }[]
    cities: { timezone: string | null } | null
  } | null
}

/** Fila de `favorites` → datos de <PlaceCard />. La portada del dueño va antes que las fotos. */
export function savedToCard(rows: SavedRow[]): PlaceCardData[] {
  return rows.flatMap((r) => {
    const p = r.places
    if (!p) return []
    const cat = p.place_categories?.[0]?.categories
    return [{
      id: p.id,
      slug: p.slug,
      name: p.name,
      vibe_line: p.vibe_line,
      price_level: p.price_level,
      photo_url: p.cover_url || p.place_photos?.find((ph) => ph.status === 'approved')?.url || null,
      category_name: cat?.name ?? null,
      category_emoji: cat?.emoji ?? null,
      hours: p.hours,
      timezone: p.cities?.timezone ?? null,
    }]
  })
}
