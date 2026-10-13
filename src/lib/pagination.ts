// Paginación de los listados (lógica pura). La página viaja en la RUTA (/c/granada-es/comer/2),
// no en `?page=`: así cada página se cachea (ISR) y una página inexistente responde 404 real.

/**
 * Segmento de ruta → número de página, o null si no es un número de página ("comer", "02",
 * "1.5", "-3", "0"). Se exige la forma canónica para no servir la misma página en dos URL.
 */
export function parsePageSegment(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,4}$/.test(value)) return null
  return Number(value)
}

/** Número de páginas (mínimo 1, aunque no haya filas). */
export function pageCount(total: number, pageSize: number): number {
  if (!(total > 0) || !(pageSize > 0)) return 1
  return Math.ceil(total / pageSize)
}

/** Desplazamiento (offset) de la primera fila de la página. */
export function pageOffset(page: number, pageSize: number): number {
  return (Math.max(1, Math.floor(page)) - 1) * pageSize
}

/** URL de una página: la primera es la ruta limpia (la canónica); el resto añade `/N`. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/${page}`
}
