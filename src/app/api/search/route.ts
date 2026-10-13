import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import tzlookup from 'tz-lookup'
import { isOpenNow, cityNowParts } from '@/lib/hours'
import { getActiveCityBySlug } from '@/lib/cities'
import { parseSearchState } from '@/features/search/search-params'

// Parámetro numérico opcional: ausente, vacío o inválido → null (un enlace viejo o un
// `lat=undefined` no deben tumbar la búsqueda entera).
const optNum = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v == null || v === '' ? null : Number(v)), schema.nullable().catch(null))

const coordsSchema = z.object({
  lat: optNum(z.number().min(-90).max(90)),
  lng: optNum(z.number().min(-180).max(180)),
})

const PAGE = 60
// "Abierto ahora" se filtra DESPUÉS de la consulta (el horario es texto OSM que se interpreta
// en TypeScript): se piden más filas para que el filtro no deje la página medio vacía.
const PAGE_OPEN_SCAN = 200

// GET /api/search?q=&city=&cat=&price=&open=1&lat=&lng=
//  · q, city, cat, price, open: mismo formato que la URL de /search (search-params.ts).
//  · city (slug de una ciudad activa): busca en esa ciudad; la distancia se mide desde su centro
//    y lat/lng se ignoran. Sin city: cerca de lat/lng (25 km).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const state = parseSearchState(sp)
  const coords = coordsSchema.safeParse({ lat: sp.get('lat'), lng: sp.get('lng') })
  if (!coords.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  // Un slug desconocido (ciudad desactivada, enlace mal copiado) no es un error: se busca por
  // ubicación y la respuesta dice `city: null` para que la interfaz lo refleje.
  const city = state.city ? await getActiveCityBySlug(state.city) : null
  const lat = city ? city.lat : coords.data.lat
  const lng = city ? city.lng : coords.data.lng

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('search_places', {
    p_q: state.q || null,
    p_category: state.cat,
    p_max_price: state.price,
    p_lat: lat,
    p_lng: lng,
    p_radius_m: 25000,
    p_limit: state.open ? PAGE_OPEN_SCAN : PAGE,
    // Solo se envía con ciudad: así la búsqueda por ubicación sigue funcionando aunque la
    // migración 0043 (que añade p_city) aún no esté aplicada.
    ...(city ? { p_city: city.id } : {}),
  } as never)
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[search] rpc falló:', error.message)
    return NextResponse.json({ error: 'No pudimos buscar ahora. Intenta de nuevo.' }, { status: 500 })
  }

  // "Abierto ahora" se evalúa en la zona horaria de la CIUDAD de cada lugar (search_places la
  // devuelve desde la migración 0035). Respaldo si faltara: la zona de las coordenadas de la
  // búsqueda (tz-lookup). Sin ninguna de las dos no se afirma nada.
  let fallbackTz: string | null = city?.timezone ?? null
  if (!fallbackTz && lat != null && lng != null) {
    try { fallbackTz = tzlookup(lat, lng) } catch { fallbackTz = null }
  }
  const nowByTz = new Map<string, ReturnType<typeof cityNowParts>>()
  const nowIn = (tz: string) => {
    let n = nowByTz.get(tz)
    if (!n) { n = cityNowParts(tz); nowByTz.set(tz, n) }
    return n
  }
  type Row = Record<string, unknown> & { timezone?: string | null; hours?: { osm_raw?: string } | null }
  const rows = ((data ?? []) as Row[]).map((r) => {
    const tz = r.timezone ?? fallbackTz
    const now = tz ? nowIn(tz) : null
    return { ...r, open_now: now ? isOpenNow(r.hours?.osm_raw, now.osmDay, now.minutes) : null }
  })

  const results = (state.open ? rows.filter((r) => r.open_now === true) : rows).slice(0, PAGE)
  return NextResponse.json({
    results,
    city: city ? { id: city.id, slug: city.slug, name: city.name } : null,
  })
}
