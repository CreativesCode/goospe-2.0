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

// De dónde salió la ubicación:
// - 'forced'  : override de desarrollo (NEXT_PUBLIC_FORCE_LOCATION) → no avisar.
// - 'gps'     : geolocalización real del navegador.
// - 'fallback': no pudimos obtener la ubicación real (permiso denegado / timeout / sin soporte).
//   Las coords devueltas son el centro de Puerto Varas SOLO como valor numérico neutro; la UI
//   NO debe mostrar ese feed a ciegas: pide activar la ubicación (ver <LocationNeededScreen />).
export type GeoSource = 'forced' | 'gps' | 'fallback'
export type GeoResult = { lat: number; lng: number; source: GeoSource }

// ─── Cache de ubicación (evita re-pedir permiso al navegar atrás/adelante) ──────
// Cada pantalla (feed, buscar, conserje, cobertura) llama a getPosition() al montar.
// Sin cache, cada remontaje dispara getCurrentPosition() otra vez → el navegador
// vuelve a mostrar el prompt de permiso. Guardamos SOLO el fix GPS real (nunca el
// fallback) en memoria + localStorage con un TTL de sesión, y lo reutilizamos.
const GEO_CACHE_KEY = 'goospe:geo'
const GEO_TTL_MS = 15 * 60 * 1000 // 15 min: fresco para descubrir cerca, sin quedar pegado
type GeoCache = { at: number; result: GeoResult }
let memo: GeoCache | null = null

function readCache(): GeoCache | null {
  if (memo) return memo
  try {
    if (typeof localStorage === 'undefined') return null
    const parsed = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || 'null') as GeoCache | null
    if (parsed && typeof parsed.at === 'number' && parsed.result?.source === 'gps') return (memo = parsed)
  } catch { /* localStorage no disponible / JSON corrupto → sin cache */ }
  return null
}

function writeCache(result: GeoResult) {
  memo = { at: Date.now(), result }
  try { localStorage?.setItem(GEO_CACHE_KEY, JSON.stringify(memo)) } catch { /* modo privado, etc. */ }
}

// Limpia la ubicación cacheada (ej. "reintentar" tras activar el permiso a mano).
export function clearCachedPosition() {
  memo = null
  try { localStorage?.removeItem(GEO_CACHE_KEY) } catch { /* no-op */ }
}

// Resuelve la ubicación del usuario: override de dev → cache → geolocalización → fallback.
export function getPosition(): Promise<GeoResult> {
  if (FORCE) return Promise.resolve({ ...FORCED, source: 'forced' })

  // Reutiliza un fix GPS reciente sin volver a pedir permiso.
  const cached = readCache()
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return Promise.resolve(cached.result)

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return resolve({ ...PUERTO_VARAS, source: 'fallback' })
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const result: GeoResult = { lat: p.coords.latitude, lng: p.coords.longitude, source: 'gps' }
        writeCache(result) // solo cacheamos GPS real
        resolve(result)
      },
      () => resolve({ ...PUERTO_VARAS, source: 'fallback' }),
      // enableHighAccuracy: pide GPS real (no solo IP/wifi).
      // timeout 12s: en móvil el primer fix suele tardar >6s → evita fallbacks falsos.
      // maximumAge 60s: acepta un fix reciente en caché → respuesta instantánea y menos timeouts.
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  })
}
