// Coordenadas a partir de lo que pega el dueño al pedir un cambio de ubicación: un par
// "lat, lng" o un enlace de mapa. Sin red: los enlaces cortos (maps.app.goo.gl) no traen
// coordenadas y devuelven null (el admin las ubica a mano con la referencia escrita).
export type LatLng = { lat: number; lng: number }

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'
const PATTERNS = [
  new RegExp(`!3d${NUM}!4d${NUM}`), // pin exacto de Google Maps
  new RegExp(`[?&](?:q|ll|query|destination|center)=(?:loc:)?${NUM}(?:,|%2C)${NUM}`, 'i'),
  new RegExp(`[?&]mlat=${NUM}&mlon=${NUM}`, 'i'), // OpenStreetMap
  new RegExp(`@${NUM},${NUM}`), // centro del visor de Google Maps
  new RegExp(`#map=\\d+/${NUM}/${NUM}`), // OpenStreetMap
  new RegExp(`^\\s*${NUM}\\s*[,;\\s]\\s*${NUM}\\s*$`), // "lat, lng"
]

export function parseLatLng(text: string | null | undefined): LatLng | null {
  const s = (text ?? '').trim()
  if (!s || s.length > 2000) return null
  for (const re of PATTERNS) {
    const m = re.exec(s)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }
  return null
}
