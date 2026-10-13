import { resolveCityChoice } from '@/features/city/city-store'
import type { CityChoice } from '@/lib/city-choice'

// Centro por defecto (coords del piloto). Fallback numérico neutro en toda la app;
// NO es una etiqueta de ciudad que se muestre al usuario.
export const DEFAULT_CENTER = { lat: -41.3195, lng: -72.9854 }

// Override para desarrollo local: si NEXT_PUBLIC_FORCE_LOCATION=1 se IGNORA la
// geolocalización real del navegador y se usa siempre el centro por defecto (o las coords
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
//   Las coords devueltas son el centro por defecto SOLO como valor numérico neutro; la UI
//   NO debe mostrar ese feed a ciegas: pide activar la ubicación (ver <LocationNeededScreen />).
// - 'city'    : el usuario eligió una ciudad a mano (selector de ciudad). Las coords son el centro
//   de esa ciudad y `city` trae cuál. Gana a todo lo demás hasta que vuelva a "cerca de mí".
export type GeoSource = 'forced' | 'gps' | 'fallback' | 'city'
export type GeoResult = { lat: number; lng: number; source: GeoSource; city?: CityChoice }

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

// Resuelve la ubicación del usuario: ciudad elegida a mano → override de dev → cache →
// geolocalización → fallback. La ciudad manual va antes que el override de desarrollo: es una
// decisión explícita del usuario y, sin eso, el selector no se podría probar con FORCE activo.
// Al volver a "cerca de mí" todo sigue como antes (FORCE incluido).
// La ciudad guardada se valida contra las ciudades activas (resolveCityChoice): una inactiva o
// inventada se descarta y se sigue como "cerca de mí", con sus gates de ubicación y cobertura.
export async function getPosition(): Promise<GeoResult> {
  const city = await resolveCityChoice()
  if (city) return { lat: city.lat, lng: city.lng, source: 'city', city }

  if (FORCE) return { ...FORCED, source: 'forced' }

  // Reutiliza un fix GPS reciente sin volver a pedir permiso.
  const cached = readCache()
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.result

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return resolve({ ...DEFAULT_CENTER, source: 'fallback' })
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const result: GeoResult = { lat: p.coords.latitude, lng: p.coords.longitude, source: 'gps' }
        writeCache(result) // solo cacheamos GPS real
        resolve(result)
      },
      () => resolve({ ...DEFAULT_CENTER, source: 'fallback' }),
      // enableHighAccuracy: pide GPS real (no solo IP/wifi).
      // timeout 12s: en móvil el primer fix suele tardar >6s → evita fallbacks falsos.
      // maximumAge 60s: acepta un fix reciente en caché → respuesta instantánea y menos timeouts.
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  })
}
