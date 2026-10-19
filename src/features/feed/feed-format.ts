// Formato de distancias del feed. Lógica pura (sin React ni red): la usan los layouts y los tests.

export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

// Tiempo estimado SIN llamar a ninguna API de rutas: la distancia es en línea recta y las velocidades
// efectivas ya absorben el rodeo de calles + tráfico. Cerca (≤600 m) mostramos "a pie" —ir en auto ahí
// no tiene sentido en una ciudad—; más lejos, "en auto". Mínimo 1 min.
const DRIVE_KMH = 28
const WALK_KMH = 4.8
const WALK_MAX_M = 600
export const fmtEta = (m: number) => {
  const walk = m <= WALK_MAX_M
  const min = Math.max(1, Math.round((m / 1000 / (walk ? WALK_KMH : DRIVE_KMH)) * 60))
  return `${min} min ${walk ? 'a pie' : 'en auto'}`
}
// Distancia + ETA, para la línea de info de cada card ("450 m · 6 min a pie" / "1,2 km · 4 min en auto").
export const fmtDistDrive = (m: number) => `${fmtDist(m)} · ${fmtEta(m)}`

/** Enlace a indicaciones en Google Maps para unas coordenadas. */
export const directionsHref = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
