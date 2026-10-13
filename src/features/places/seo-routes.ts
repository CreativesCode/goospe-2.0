// Rutas de los listados SEO y elección de la imagen para compartir (lógica pura).
//
// Esquema: /c/[ciudad] y /c/[ciudad]/[categoria]. El prefijo fijo `/c` evita que un slug de
// ciudad choque con una ruta de primer nivel (/events, /places, /search, …), hoy o mañana.

import { parsePageSegment } from '@/lib/pagination'
import { isUuid } from '@/lib/validation'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Slug de ciudad o categoría tal como vive en la BD ("puerto-varas", "granada-es", "cafe"). */
export function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && SLUG_RE.test(value)
}

/**
 * ¿La ruta es de un listado (/c/**) o de un evento (/events/[id]) pero con una FORMA imposible?
 * ("/c/Foo!", "/c/x/1", "/c/x/02", "/c/x/comer/abc", "/events/abc"). Lo usa el proxy para
 * responder 404 antes de llegar a la página: así la basura no se renderiza ni ocupa una entrada
 * en la caché ISR. Un slug bien formado que no existe sigue llegando a la página (404 allí).
 */
export function isMalformedSeoPath(pathname: string): boolean {
  const parts = pathname.replace(/\/+$/, '').split('/').slice(1)
  if (parts[0] === 'events' && parts.length === 2) return !isUuid(parts[1])
  if (parts[0] !== 'c' || parts.length < 2 || parts.length > 4) return false
  const [, city, segment, page] = parts
  if (!isSlug(city)) return true
  if (segment === undefined) return false
  // Solo dígitos = número de página: debe ser canónico y ≥ 2 (la 1 vive en la ruta limpia).
  const numeric = /^\d+$/.test(segment)
  if (numeric) return page !== undefined || (parsePageSegment(segment) ?? 1) === 1
  if (!isSlug(segment)) return true
  return page !== undefined && (parsePageSegment(page) ?? 1) === 1
}

export const cityPath = (citySlug: string) => `/c/${citySlug}`
export const cityCategoryPath = (citySlug: string, categorySlug: string) => `/c/${citySlug}/${categorySlug}`
export const placePath = (slug: string) => `/places/${slug}`
export const placeOgPath = (slug: string) => `/places/${slug}/og`
export const eventPath = (id: string) => `/events/${id}`
export const eventOgPath = (id: string) => `/events/${id}/og`
export const eventIcsPath = (id: string) => `/events/${id}/ics`

const CATEGORY_HEADLINE: Record<string, (city: string) => string> = {
  comer: (city) => `Dónde comer en ${city}`,
  cafe: (city) => `Cafés en ${city}`,
  beber: (city) => `Bares en ${city}`,
  noche: (city) => `Vida nocturna en ${city}`,
}

/** Titular (h1 y <title>) de un listado. Una categoría sin frase propia usa "{Categoría} en {ciudad}". */
export function listingHeadline(cityName: string, category?: { slug: string; name: string } | null): string {
  if (!category) return `Qué hacer en ${cityName}`
  return CATEGORY_HEADLINE[category.slug]?.(cityName) ?? `${category.name} en ${cityName}`
}

/** Las fotos de Google se sirven por este proxy; si la facturación de Google cae, devuelve error. */
export const isGooglePhotoProxy = (url: string) => url.startsWith('/api/place-photo')

type Photo = { url: string; status: string | null }

/**
 * Imagen para compartir (og:image) de un lugar. Nunca el proxy de fotos de Google: un
 * rastreador de redes sociales recibiría un error y la tarjeta saldría sin imagen. Orden:
 * portada del dueño → foto aprobada propia (Storage) → imagen generada de la ficha.
 */
export function placeShareImage(slug: string, coverUrl: string | null | undefined, photos: Photo[] | null | undefined): string {
  const usable = (url: string | null | undefined): url is string =>
    !!url && !isGooglePhotoProxy(url) && /^https?:\/\//.test(url)
  if (usable(coverUrl)) return coverUrl
  const approved = (photos ?? []).find((p) => p.status === 'approved' && usable(p.url))
  return approved ? approved.url : placeOgPath(slug)
}

/** Texto corto para <meta description>: una sola línea, cortada en palabra completa. */
export function metaDescription(text: string | null | undefined, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`
}
