// Núcleo OSM reutilizable (extraído de osm-import.mjs): fetch Overpass + construcción de
// registros de places parametrizada por ciudad. Lo usan tanto osm-import.mjs (Puerto Varas
// standalone) como el pipeline del cargador de zonas (pipeline.mjs).

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export const normName = (s) => stripAccents(String(s).toLowerCase()).replace(/\s+/g, ' ').trim()
export const slugify = (s) =>
  stripAccents(String(s).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const osmTagOf = (tags) =>
  tags.amenity ? `amenity=${tags.amenity}` : tags.shop ? `shop=${tags.shop}` : null

function parseAddress(tags) {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  const city = tags['addr:city'] ?? tags['addr:place'] ?? null
  if (!street && !number && !city) return null
  const formatted = [street, number].filter(Boolean).join(' ') || city || null
  return { street: street ?? null, number: number ?? null, city, formatted }
}

function parseTags(tags) {
  const out = []
  if (tags.cuisine) out.push(...tags.cuisine.split(';').map((t) => t.trim()).filter(Boolean))
  if (tags.diet_vegetarian === 'yes') out.push('vegetariano')
  if (tags.diet_vegan === 'yes') out.push('vegano')
  if (tags.outdoor_seating === 'yes') out.push('terraza')
  return [...new Set(out)]
}

const firstOf = (tags, keys) => keys.map((k) => tags[k]).find(Boolean) ?? null

const UA = 'goospe-etl/0.2 (multi-city loader; contact: titanicfactorymedia@gmail.com)'

// Carga los mapeos osm_tag→category_id y los slugs de categoría.
export async function loadCategoryMaps(sb) {
  const { data: mappings, error } = await sb.from('category_mappings').select('osm_tag, category_id')
  if (error) throw error
  const tagToCat = new Map(mappings.map((m) => [m.osm_tag, m.category_id]))
  const { data: cats } = await sb.from('categories').select('id, slug')
  const catSlug = new Map((cats ?? []).map((c) => [c.id, c.slug]))
  return { tagToCat, catSlug }
}

// Trae POIs de la vertical (comida/café/bares) dentro del bbox [sur, oeste, norte, este].
export async function fetchOverpass(bbox) {
  const amenities = 'restaurant|fast_food|cafe|bar|pub|biergarten|nightclub|ice_cream|food_court'
  const shops = 'bakery|pastry'
  const [s, w, n, e] = bbox
  const bb = `(${s},${w},${n},${e})`
  const ql = `[out:json][timeout:90];
(
  node["amenity"~"^(${amenities})$"]${bb};
  way["amenity"~"^(${amenities})$"]${bb};
  node["shop"~"^(${shops})$"]${bb};
  way["shop"~"^(${shops})$"]${bb};
);
out center tags;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: 'data=' + encodeURIComponent(ql),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return json.elements ?? []
}

// Construye los registros de places (dedup <Nm, mapeo de categoría) para una ciudad.
// Devuelve { records: [{ nn, lat, lng, categoryId, record }], stats }.
export function buildPlaceRecords(elements, { cityId, tagToCat, dedupeMeters = 50 }) {
  let noName = 0
  let noCat = 0
  const accepted = []
  for (const el of elements) {
    const tags = el.tags ?? {}
    const name = tags.name
    if (!name) { noName++; continue }
    const osmTag = osmTagOf(tags)
    const categoryId = osmTag ? tagToCat.get(osmTag) : null
    if (!categoryId) { noCat++; continue }

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    const nn = normName(name)
    const dup = accepted.find((a) => a.nn === nn && haversine(a.lat, a.lng, lat, lng) < dedupeMeters)
    if (dup) continue

    accepted.push({
      nn, lat, lng, categoryId,
      record: {
        slug: `${slugify(name)}-${el.type[0]}${el.id}`,
        name,
        city_id: cityId,
        location: `SRID=4326;POINT(${lng} ${lat})`,
        address: parseAddress(tags),
        phone: firstOf(tags, ['phone', 'contact:phone']),
        whatsapp: firstOf(tags, ['contact:whatsapp']),
        website: firstOf(tags, ['website', 'contact:website']),
        instagram: firstOf(tags, ['contact:instagram']),
        email: firstOf(tags, ['email', 'contact:email']),
        hours: tags.opening_hours ? { osm_raw: tags.opening_hours } : null,
        tags: parseTags(tags),
        source: 'osm',
        is_published: true,
      },
    })
  }
  return { records: accepted, stats: { noName, noCat, accepted: accepted.length } }
}
