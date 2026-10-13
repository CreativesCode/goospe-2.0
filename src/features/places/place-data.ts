import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

// Lectura de la ficha de un lugar. La comparten la ficha pública, su vista previa (dueño /
// admin) y la imagen para compartir. Va con service role (salta la RLS): quien la use decide
// qué hacer con un lugar no publicado — la ficha pública responde 404.
const PLACE_SELECT =
  'id, slug, name, address, phone, whatsapp, website, instagram, email, hours, price_level, description, vibe_line, tags, menu, ai_enriched_at, embedding_model, source, claimed, business_id, is_published, cover_url, logo_url, created_at, updated_at, place_photos(id, url, status, source, storage_path), place_categories(categories(emoji, name, slug)), cities(timezone, slug, name)'

// `cache()` dedupe la consulta dentro del mismo request: generateMetadata y el render de la
// página comparten UNA sola query.
export const getPlace = cache(async (slug: string) => {
  const sb = createAdminClient()
  const { data } = await sb.from('places').select(PLACE_SELECT).eq('slug', slug).maybeSingle()
  return data
})

export type PlaceRecord = NonNullable<Awaited<ReturnType<typeof getPlace>>>
export type PlaceCategory = { emoji: string | null; name: string; slug: string }
export type PlaceCity = { timezone: string; slug: string; name: string }

export const placeCity = (place: PlaceRecord) =>
  (place as unknown as { cities: PlaceCity | null }).cities ?? null

export const placeCategories = (place: PlaceRecord) =>
  ((place.place_categories ?? []) as unknown as { categories: PlaceCategory | null }[])
    .map((pc) => pc.categories)
    .filter((c): c is PlaceCategory => !!c)

export const placePhotos = (place: PlaceRecord) =>
  (place.place_photos ?? []) as unknown as { id: string; url: string; status: string | null }[]
