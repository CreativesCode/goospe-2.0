import { z } from 'zod'

// Pesos del ranking del feed. Módulo puro (lo usan la página /admin/ranking, su server action y
// los tests). Viven en feed_config, fila `feed_ranking`; get_feed los lee en cada llamada
// (migración 0043). Los valores por defecto son los que estaban fijos en el SQL: con la fila
// ausente o con un valor inválido, get_feed usa exactamente estos.
//
//   score = distance · e^(−dist_m / distance_decay_m)
//         + trending · (trending_score / 5)
//         + novelty  · hash(id) ∈ [0, 1]          (estable por lugar: no es aleatorio)
//         + affinity · similitud(gusto, lugar)     (solo con sesión y perfil de gusto)
//         + boost                                   (solo si el lugar tiene un boost activo)
export const FEED_RANKING_KEY = 'feed_ranking'

export const WEIGHT_KEYS = ['distance', 'distance_decay_m', 'trending', 'novelty', 'affinity', 'boost'] as const
export type WeightKey = (typeof WEIGHT_KEYS)[number]
export type RankingWeights = Record<WeightKey, number>

export const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 0.45,
  distance_decay_m: 2500,
  trending: 0.25,
  novelty: 0.1,
  affinity: 0.2,
  boost: 1,
}

/** Rangos editables. Más estrechos que los que tolera el SQL (0–5 y 100–100000). */
export const WEIGHT_FIELDS: {
  key: WeightKey; label: string; help: string; min: number; max: number; step: number
}[] = [
  { key: 'distance', label: 'Cercanía', help: 'Cuánto pesa estar cerca. Decae con la distancia.', min: 0, max: 2, step: 0.01 },
  { key: 'distance_decay_m', label: 'Distancia de caída (m)', help: 'A esta distancia la cercanía vale el 37 % de su peso. Más alto = llegan lugares más lejanos.', min: 250, max: 50000, step: 50 },
  { key: 'trending', label: 'Tendencia', help: 'Lugares con actividad reciente (se recalcula cada noche).', min: 0, max: 2, step: 0.01 },
  { key: 'novelty', label: 'Variedad', help: 'Mezcla estable por lugar para que el feed no sea solo "lo más cercano".', min: 0, max: 2, step: 0.01 },
  { key: 'affinity', label: 'Afinidad de gusto', help: 'Parecido entre el perfil de gusto del usuario y el lugar. Solo con sesión.', min: 0, max: 2, step: 0.01 },
  { key: 'boost', label: 'Boost (destacados)', help: 'Suma fija para lugares con boost activo. Por encima de la suma del resto los pone siempre primero.', min: 0, max: 5, step: 0.05 },
]

const bounds = Object.fromEntries(WEIGHT_FIELDS.map((f) => [f.key, f])) as Record<WeightKey, (typeof WEIGHT_FIELDS)[number]>

const field = (key: WeightKey) => {
  const { label, min, max } = bounds[key]
  return z.preprocess(
    // Acepta "0,45" (coma decimal). Vacío o no numérico → NaN → lo rechaza el schema.
    (v) => (typeof v === 'string' ? (v.trim() === '' ? Number.NaN : Number(v.trim().replace(',', '.'))) : v),
    z.number({ error: `${label}: escribe un número` })
      .refine(Number.isFinite, { error: `${label}: escribe un número` })
      .min(min, { error: `${label}: mínimo ${min}` })
      .max(max, { error: `${label}: máximo ${max}` })
  )
}

/** Organicos = lo que ordena el feed sin contar el boost. */
const ORGANIC: WeightKey[] = ['distance', 'trending', 'novelty', 'affinity']

export const weightsSchema = z.object({
  distance: field('distance'),
  distance_decay_m: field('distance_decay_m'),
  trending: field('trending'),
  novelty: field('novelty'),
  affinity: field('affinity'),
  boost: field('boost'),
}).refine((w) => ORGANIC.some((k) => w[k] > 0), {
  error: 'Al menos uno de cercanía, tendencia, variedad o afinidad debe ser mayor que 0: con todos en 0 el feed pierde su orden.',
})

export function parseWeights(input: unknown): { ok: true; weights: RankingWeights } | { ok: false; error: string } {
  const parsed = weightsSchema.safeParse(input)
  if (parsed.success) return { ok: true, weights: roundWeights(parsed.data) }
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Valores inválidos' }
}

/** 4 decimales para los pesos y metros enteros: evita guardar 0.30000000000000004. */
export function roundWeights(w: RankingWeights): RankingWeights {
  const r = (n: number) => Math.round(n * 10000) / 10000
  return {
    distance: r(w.distance), distance_decay_m: Math.round(w.distance_decay_m),
    trending: r(w.trending), novelty: r(w.novelty), affinity: r(w.affinity), boost: r(w.boost),
  }
}

/**
 * Pesos efectivos a partir de lo guardado en feed_config. Misma regla que el SQL: cada clave
 * ausente, no numérica o fuera del rango que tolera get_feed cae a su valor por defecto.
 */
export function readWeights(value: unknown): RankingWeights {
  const v = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>
  const pick = (key: WeightKey, min: number, max: number) => {
    const n = v[key]
    return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : DEFAULT_WEIGHTS[key]
  }
  return {
    distance: pick('distance', 0, 5),
    distance_decay_m: pick('distance_decay_m', 100, 100000),
    trending: pick('trending', 0, 5),
    novelty: pick('novelty', 0, 5),
    affinity: pick('affinity', 0, 5),
    boost: pick('boost', 0, 5),
  }
}

export const isDefaultWeights = (w: RankingWeights) => WEIGHT_KEYS.every((k) => w[k] === DEFAULT_WEIGHTS[k])

/** Claves que cambian entre dos configuraciones, con su antes y después (para la bitácora). */
export function diffWeights(before: RankingWeights, after: RankingWeights) {
  const out: Partial<Record<WeightKey, { from: number; to: number }>> = {}
  for (const k of WEIGHT_KEYS) if (before[k] !== after[k]) out[k] = { from: before[k], to: after[k] }
  return out
}

/**
 * Reparto del score orgánico máximo (sin boost) entre sus cuatro factores, en % que suman 100.
 * Sirve para leer la configuración de un vistazo: "la cercanía es el 45 % del orden".
 */
export function organicShares(w: RankingWeights): Record<'distance' | 'trending' | 'novelty' | 'affinity', number> {
  const total = w.distance + w.trending + w.novelty + w.affinity
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)
  return { distance: pct(w.distance), trending: pct(w.trending), novelty: pct(w.novelty), affinity: pct(w.affinity) }
}
