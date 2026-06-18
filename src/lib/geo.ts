// Ubicación de Puerto Varas (centro). Fallback por defecto en toda la app.
export const PUERTO_VARAS = { lat: -41.3195, lng: -72.9854 }

// Override para desarrollo local: si NEXT_PUBLIC_FORCE_LOCATION=1 se IGNORA la
// geolocalización real del navegador y se usa siempre Puerto Varas (o las coords
// de NEXT_PUBLIC_FORCE_LAT / NEXT_PUBLIC_FORCE_LNG). Útil cuando pruebas desde
// otra ciudad o detrás de una VPN: así el feed/conserje siempre tienen lugares cerca.
const FORCE = process.env.NEXT_PUBLIC_FORCE_LOCATION === '1'
// Posición GPS por defecto para desarrollo: 41°19'29.4"S 72°58'22.1"W.
const FORCE_DEFAULT = { lat: -41.324833, lng: -72.972806 }
const FORCED = {
  lat: Number(process.env.NEXT_PUBLIC_FORCE_LAT) || FORCE_DEFAULT.lat,
  lng: Number(process.env.NEXT_PUBLIC_FORCE_LNG) || FORCE_DEFAULT.lng,
}

// Resuelve la ubicación del usuario: override de dev → geolocalización → fallback.
export function getPosition(): Promise<{ lat: number; lng: number }> {
  if (FORCE) return Promise.resolve(FORCED)
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(PUERTO_VARAS)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(PUERTO_VARAS),
      { timeout: 6000 }
    )
  })
}
