import { z } from 'zod'

// Ciudad elegida a mano por el usuario (selector de ciudad). Módulo PURO, sin 'use client' ni
// 'server-only': lo importan el navegador (src/features/city/*) y el servidor
// (src/lib/city-choice-server.ts). Contrato para el resto de la app:
//
//   · Cookie `goospe_city` (no httpOnly, 1 año, path=/, SameSite=Lax). Valor = JSON de CityChoice
//     pasado por encodeURIComponent. Sin cookie = "cerca de mí" (geolocalización).
//   · En el navegador:  useCityChoice() / getCityChoice() de '@/features/city/city-store'.
//   · En el servidor:   getCityChoice() de '@/lib/city-choice-server' (lee cookies()).
//   · La cookie la escribe el cliente: es una PREFERENCIA, no un permiso. Quien la use en el
//     servidor debe tratar `id` como no fiable (usarlo solo para filtrar lecturas públicas).
export const CITY_COOKIE = 'goospe_city'
export const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
/** Evento del navegador que se emite al cambiar o limpiar la ciudad. */
export const CITY_EVENT = 'goospe:city-change'

export const cityChoiceSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
export type CityChoice = z.infer<typeof cityChoiceSchema>

/** Ciudad activa tal como la devuelve /api/cities (RPC active_cities). */
export type ActiveCity = CityChoice & {
  region: string | null
  country: string
  timezone: string
  places: number
}

export const toChoice = (c: CityChoice): CityChoice => ({
  id: c.id, slug: c.slug, name: c.name, lat: c.lat, lng: c.lng,
})

/** Valor listo para guardar en la cookie / localStorage. */
export function serializeCityChoice(c: CityChoice): string {
  return encodeURIComponent(JSON.stringify(toChoice(c)))
}

/** Lee el valor de la cookie (o de localStorage). Cualquier cosa inválida → null. */
export function parseCityChoice(raw: string | null | undefined): CityChoice | null {
  if (!raw || raw.length > 600) return null
  try {
    const decoded = raw.trim().startsWith('{') ? raw : decodeURIComponent(raw)
    const parsed = cityChoiceSchema.safeParse(JSON.parse(decoded))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * La ciudad elegida solo vale si sigue siendo una ciudad ACTIVA (mismo id y slug). Devuelve la
 * versión del servidor (nombre y centro reales), no la de la cookie: la cookie la escribe el
 * navegador y puede traer una ciudad desactivada, inventada o con coordenadas cambiadas.
 */
export function matchActiveCity<T extends CityChoice>(choice: CityChoice | null | undefined, active: readonly T[]): T | null {
  if (!choice) return null
  return active.find((c) => c.id === choice.id && c.slug === choice.slug) ?? null
}

/** Extrae la ciudad de una cabecera `Cookie` o de `document.cookie`. */
export function cityChoiceFromCookieHeader(header: string | null | undefined): CityChoice | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === CITY_COOKIE) return parseCityChoice(part.slice(eq + 1).trim())
  }
  return null
}

// ── búsqueda en el selector ────────────────────────────────────────────────────────────────
/** minúsculas y sin acentos: "Maullín" → "maullin". */
export const foldText = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Filtra las ciudades por nombre, región o país (sin acentos ni mayúsculas). Primero las que
 * EMPIEZAN por el texto, luego las que lo contienen; dentro de cada grupo, orden original.
 */
export function filterCities<T extends { name: string; region: string | null; country: string }>(
  cities: T[],
  query: string
): T[] {
  const q = foldText(query)
  if (!q) return cities
  const starts: T[] = []
  const contains: T[] = []
  for (const c of cities) {
    const name = foldText(c.name)
    if (name.startsWith(q)) starts.push(c)
    else if (name.includes(q) || foldText(c.region ?? '').includes(q) || foldText(c.country).includes(q)) contains.push(c)
  }
  return [...starts, ...contains]
}

/** Agrupa por país conservando el orden de entrada. */
export function groupByCountry<T extends { country: string }>(cities: T[]): { country: string; cities: T[] }[] {
  const groups: { country: string; cities: T[] }[] = []
  for (const c of cities) {
    const g = groups.find((x) => x.country === c.country)
    if (g) g.cities.push(c)
    else groups.push({ country: c.country, cities: [c] })
  }
  return groups
}
