// Paginación del feed por CURSOR (keyset). Módulo puro, con tests (tests/feed-cursor.test.ts).
//
// get_feed ordena por (score desc, distance_m asc, id asc): un orden total y determinista (la
// "novedad" es un hash del id, no un aleatorio). El cursor son esos tres valores de la última
// fila recibida; la página siguiente pide "estrictamente después". Frente al offset:
//   · si entre dos páginas aparece o desaparece un lugar por delante (uno recién publicado, un
//     boost que termina), el offset desplaza la ventana y repite o se salta filas; el cursor no;
//   · no hay "reshuffle": la página N+1 siempre continúa donde terminó la N.
// Lo que el cursor NO puede evitar: si el score de un lugar ya mostrado BAJA entre páginas
// (recalculo de tendencias, fin de un boost) puede volver a salir más abajo. Por eso la unión
// de páginas además deduplica por id.

export type FeedCursor = { score: number; dist: number; id: string }

type Keyed = { id: string; distance_m: number; score?: number | null }

/** Cursor de la última fila de una página; null si no hay filas o no traen score (BD antigua). */
export function cursorOf(rows: Keyed[]): FeedCursor | null {
  const last = rows[rows.length - 1]
  if (!last) return null
  const score = last.score
  if (typeof score !== 'number' || !Number.isFinite(score) || !Number.isFinite(last.distance_m)) return null
  return { score, dist: last.distance_m, id: last.id }
}

// ── Por qué el cursor NO se envía tal cual ───────────────────────────────────────────────────
// La BD de producción corre con `extra_float_digits = 0`: Postgres escribe los double con 15
// cifras significativas, no con las 17 que hacen falta para reconstruirlos. El score y la
// distancia que llegan por JSON son, por tanto, un REDONDEO del valor que get_feed compara:
//   · redondeo hacia arriba → `s.score < p_after_score` vuelve a incluir la última fila
//     (la página 2 empezaba repitiendo la última de la página 1);
//   · redondeo hacia abajo  → se saltarían las filas cuyo score cae entre el redondeo y el real.
// El valor exacto no se puede recuperar en el cliente, así que se envía una COTA: un score que
// con seguridad es ≥ el real (y una distancia ≤ la real). Con una cota superior nunca se salta
// nada; lo único que puede pasar es que vuelvan la última fila y alguna vecina con el score
// casi idéntico, y esas las quita `mergePage` (deduplica por id). Resultado: mismas filas y
// mismo orden que la paginación ideal.

/** Error relativo máximo de redondear a 15 cifras significativas (5e-15), con margen. */
const FLOAT_SLACK = 1e-14

/**
 * Menor valor que podemos garantizar ≥ el score real. El 0 es exacto: un double distinto de
 * cero nunca se imprime como "0", así que ahí la igualdad del SQL sí funciona.
 */
export function scoreCeiling(score: number): number {
  return score === 0 ? 0 : score + Math.abs(score) * FLOAT_SLACK
}

/** Mayor valor que podemos garantizar ≤ la distancia real (desempate cuando el score empata). */
export function distanceFloor(dist: number): number {
  return dist === 0 ? 0 : dist - Math.abs(dist) * FLOAT_SLACK
}

/** Argumentos de get_feed para pedir la página que sigue al cursor (ver nota de arriba). */
export function cursorArgs(c: FeedCursor) {
  return { p_after_score: scoreCeiling(c.score), p_after_dist: distanceFloor(c.dist), p_after_id: c.id }
}

/**
 * ¿El cursor dejó de avanzar? Una página llena en la que TODAS las filas ya se habían recibido.
 * Solo puede pasar si más de una página entera de lugares comparte el mismo score dentro del
 * margen de la cota (p. ej. pesos del ranking a cero y distancias idénticas). En ese caso se
 * sigue paginando por offset, que con un orden estable no repite ni salta.
 */
export function isStalledPage(rows: { id: string }[], seen: ReadonlySet<string>, pageSize: number): boolean {
  return pageIsFull(rows.length, pageSize) && rows.every((r) => seen.has(r.id))
}

/** Clave de la posición con la que se pidió el feed (~11 m): identifica una "sesión" de feed. */
export const positionKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`

/**
 * Une una página nueva a lo ya cargado: sin duplicados (por id) y sin lo que el usuario descartó.
 * Devuelve `prev` tal cual (misma referencia) si la página no aporta nada.
 */
export function mergePage<T extends { id: string }>(prev: T[], page: T[], dismissed?: ReadonlySet<string>): T[] {
  const seen = new Set(prev.map((p) => p.id))
  const fresh: T[] = []
  for (const row of page) {
    if (seen.has(row.id) || dismissed?.has(row.id)) continue
    seen.add(row.id)
    fresh.push(row)
  }
  return fresh.length ? [...prev, ...fresh] : prev
}

/** Hay más páginas mientras la última vino llena (se mide sobre las filas CRUDAS del servidor). */
export const pageIsFull = (rawCount: number, pageSize: number) => rawCount >= pageSize
