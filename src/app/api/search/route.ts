import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOpenNow, cityNowParts } from '@/lib/hours'

// GET /api/search?q=&cat=&price=&open=1&lat=&lng=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null)

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('search_places', {
    p_q: sp.get('q') || null,
    p_category: num(sp.get('cat')),
    p_max_price: num(sp.get('price')),
    p_lat: num(sp.get('lat')),
    p_lng: num(sp.get('lng')),
    p_radius_m: 25000,
    p_limit: 60,
  } as never)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = cityNowParts()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map((r) => ({
    ...r,
    open_now: isOpenNow((r.hours as { osm_raw?: string } | null)?.osm_raw, now.osmDay, now.minutes),
  }))

  const results = sp.get('open') === '1' ? rows.filter((r) => r.open_now === true) : rows
  return NextResponse.json({ results })
}
