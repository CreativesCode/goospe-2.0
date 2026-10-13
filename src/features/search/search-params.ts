// Estado del buscador ⇄ URL. Módulo puro, con tests (tests/search-params.test.ts).
// Todo el estado vive en la URL (/search?q=cafe&city=granada-es&cat=2&price=2&open=1): un enlace
// reproduce la búsqueda y atrás/adelante del navegador recorre los cambios de filtros.

export type SearchState = {
  /** Texto buscado (recortado, máx. 80). '' = sin texto. */
  q: string
  /** Slug de la ciudad. null = cerca de la ubicación del dispositivo. */
  city: string | null
  /** Id de categoría. */
  cat: number | null
  /** Precio máximo (1–4). */
  price: number | null
  /** Solo abiertos ahora. */
  open: boolean
}

export const EMPTY_SEARCH: SearchState = { q: '', city: null, cat: null, price: null, open: false }

export const SEARCH_Q_MAX = 80
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type Params = URLSearchParams | Record<string, string | string[] | undefined>

function first(params: Params, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)
  const v = params[key]
  return (Array.isArray(v) ? v[0] : v) ?? null
}

const intIn = (raw: string | null, min: number, max: number): number | null => {
  if (raw == null || !/^\d{1,6}$/.test(raw.trim())) return null
  const n = Number(raw)
  return n >= min && n <= max ? n : null
}

/** Texto de búsqueda saneado: sin caracteres de control, espacios colapsados, máx. 80. */
export function cleanQuery(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SEARCH_Q_MAX)
}

/** Lee el estado de la URL. Cualquier valor inválido se ignora (un enlace viejo no rompe nada). */
export function parseSearchState(params: Params): SearchState {
  const city = (first(params, 'city') ?? '').trim().toLowerCase()
  return {
    q: cleanQuery(first(params, 'q')),
    city: city.length <= 80 && SLUG_RE.test(city) ? city : null,
    cat: intIn(first(params, 'cat'), 1, 100000),
    price: intIn(first(params, 'price'), 1, 4),
    open: first(params, 'open') === '1',
  }
}

/** Query string canónica: orden fijo y sin valores por defecto (la misma búsqueda → la misma URL). */
export function serializeSearchState(s: SearchState): string {
  const p = new URLSearchParams()
  const q = cleanQuery(s.q)
  if (q) p.set('q', q)
  if (s.city) p.set('city', s.city)
  if (s.cat != null) p.set('cat', String(s.cat))
  if (s.price != null) p.set('price', String(s.price))
  if (s.open) p.set('open', '1')
  return p.toString()
}

export function searchHref(s: SearchState, base = '/search'): string {
  const qs = serializeSearchState(s)
  return qs ? `${base}?${qs}` : base
}

/** Filtros que el usuario puede "limpiar" (la ciudad no es un filtro: es dónde se busca). */
export const hasFilters = (s: SearchState) => cleanQuery(s.q) !== '' || s.cat != null || s.price != null || s.open

export const clearFilters = (s: SearchState): SearchState => ({ ...EMPTY_SEARCH, city: s.city })

export const sameSearch = (a: SearchState, b: SearchState) => serializeSearchState(a) === serializeSearchState(b)

/**
 * Query string para /api/search. Con ciudad se busca en esa ciudad y las coordenadas no se
 * envían (la distancia se mide desde su centro); sin ciudad, cerca de `pos`.
 */
export function searchApiQuery(s: SearchState, pos: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams(serializeSearchState(s))
  if (!s.city && pos) {
    p.set('lat', String(pos.lat))
    p.set('lng', String(pos.lng))
  }
  return p.toString()
}
