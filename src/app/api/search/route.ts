import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import tzlookup from 'tz-lookup'
import { isOpenNow, cityNowParts } from '@/lib/hours'

// Parámetro numérico opcional: ausente, vacío o inválido → null (un enlace viejo o un
// `lat=undefined` no deben tumbar la búsqueda entera).
const optNum = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v == null || v === '' ? null : Number(v)), schema.nullable().catch(null))

const paramsSchema = z.object({
  // Sin caracteres de control (incluye \0, que Postgres rechaza) y recortada a 80.
  q: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || null : null),
    z.string().nullable()
  ),
  cat: optNum(z.number().int().min(1).max(100000)),
  price: optNum(z.number().int().min(1).max(4)),
  lat: optNum(z.number().min(-90).max(90)),
  lng: optNum(z.number().min(-180).max(180)),
})

// GET /api/search?q=&cat=&price=&open=1&lat=&lng=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const parsed = paramsSchema.safeParse({
    q: sp.get('q'), cat: sp.get('cat'), price: sp.get('price'), lat: sp.get('lat'), lng: sp.get('lng'),
  })
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  const p = parsed.data

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('search_places', {
    p_q: p.q,
    p_category: p.cat,
    p_max_price: p.price,
    p_lat: p.lat,
    p_lng: p.lng,
    p_radius_m: 25000,
    p_limit: 60,
  } as never)
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[search] rpc falló:', error.message)
    return NextResponse.json({ error: 'No pudimos buscar ahora. Intenta de nuevo.' }, { status: 500 })
  }

  // "Abierto ahora" se evalúa en la zona horaria de la CIUDAD de cada lugar (search_places la
  // devuelve desde la migración 0035). Respaldo mientras no esté aplicada, o si faltara: la
  // zona de las coordenadas de la búsqueda (tz-lookup). Sin ninguna de las dos no se afirma nada.
  let fallbackTz: string | null = null
  if (p.lat != null && p.lng != null) {
    try { fallbackTz = tzlookup(p.lat, p.lng) } catch { fallbackTz = null }
  }
  const nowByTz = new Map<string, ReturnType<typeof cityNowParts>>()
  const nowIn = (tz: string) => {
    let n = nowByTz.get(tz)
    if (!n) { n = cityNowParts(tz); nowByTz.set(tz, n) }
    return n
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map((r) => {
    const tz = (r.timezone as string | null | undefined) ?? fallbackTz
    const raw = (r.hours as { osm_raw?: string } | null)?.osm_raw
    const now = tz ? nowIn(tz) : null
    return { ...r, open_now: now ? isOpenNow(raw, now.osmDay, now.minutes) : null }
  })

  const results = sp.get('open') === '1' ? rows.filter((r) => r.open_now === true) : rows
  return NextResponse.json({ results })
}
