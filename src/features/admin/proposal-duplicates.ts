// Heurística de duplicados al aprobar una propuesta de lugar. Lógica pura: la RPC
// place_proposal_duplicates (0039) trae los candidatos con distancia y similitud de nombre
// (pg_trgm sin tildes); aquí se decide qué tan probable es que sea el mismo lugar.

/** Radio en el que dos lugares se consideran "en el mismo sitio". */
export const NEAR_M = 150
/** Similitud de trigramas a partir de la cual dos nombres "se parecen". */
export const SIMILAR_NAME = 0.45
/** Similitud a partir de la cual el nombre es prácticamente el mismo. */
export const SAME_NAME = 0.8
/** Un nombre casi idéntico sigue siendo sospechoso aunque el pin esté algo corrido. */
const SAME_NAME_RADIUS_M = 1000

export type DuplicateCandidate = {
  id: string
  slug: string
  name: string
  /** null si la propuesta no trae coordenadas. */
  distance_m: number | null
  similarity: number
  claimed: boolean
  is_published: boolean
  city_name: string | null
}

/**
 * high     -> casi seguro el mismo lugar: aprobar exige confirmarlo expresamente.
 * possible -> conviene mirarlo (cerca con otro nombre, o nombre parecido en otra parte).
 * null     -> no es un candidato.
 */
export type DuplicateLevel = 'high' | 'possible' | null

export function duplicateLevel(c: Pick<DuplicateCandidate, 'distance_m' | 'similarity'>): DuplicateLevel {
  const near = c.distance_m !== null && c.distance_m <= NEAR_M
  const similar = c.similarity >= SIMILAR_NAME
  if (near && similar) return 'high'
  // Sin coordenadas no se puede descartar por distancia: un nombre idéntico cuenta como alto.
  if (c.similarity >= SAME_NAME && (c.distance_m === null || c.distance_m <= SAME_NAME_RADIUS_M)) return 'high'
  return near || similar ? 'possible' : null
}

export type RankedDuplicate = DuplicateCandidate & { level: Exclude<DuplicateLevel, null> }

/** Candidatos clasificados: primero los probables, luego por parecido y por cercanía. */
export function rankDuplicates(rows: DuplicateCandidate[]): RankedDuplicate[] {
  return rows
    .flatMap((c) => {
      const level = duplicateLevel(c)
      return level ? [{ ...c, level }] : []
    })
    .sort((a, b) =>
      Number(b.level === 'high') - Number(a.level === 'high')
      || b.similarity - a.similarity
      || (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
}

/** Sanea lo que llega de la RPC (numeric/real pueden venir como texto). */
export function normalizeDuplicates(data: unknown): DuplicateCandidate[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((r) => {
    const row = (r ?? {}) as Record<string, unknown>
    const similarity = Number(row.similarity)
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !Number.isFinite(similarity)) return []
    const distance = row.distance_m === null || row.distance_m === undefined ? null : Number(row.distance_m)
    return [{
      id: row.id,
      slug: typeof row.slug === 'string' ? row.slug : '',
      name: row.name,
      distance_m: distance !== null && Number.isFinite(distance) ? distance : null,
      similarity,
      claimed: row.claimed === true,
      is_published: row.is_published === true,
      city_name: typeof row.city_name === 'string' ? row.city_name : null,
    }]
  })
}

/** "120 m" / "1,4 km" para la lista del admin. */
export function formatDistance(m: number | null): string {
  if (m === null) return 'sin coordenadas'
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}
