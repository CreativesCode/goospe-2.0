import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedQuery, pickPlaces, type Candidate } from '@/lib/ai/openai'

const FALLBACK = { lat: -41.3195, lng: -72.9854 } // Puerto Varas

// POST { query, lat?, lng? } → { picks: [{...place, reason}] }
export async function POST(req: NextRequest) {
  let body: { query?: string; lat?: number; lng?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const query = (body.query ?? '').trim()
  if (query.length < 2) return NextResponse.json({ error: 'Escribe qué buscas' }, { status: 400 })
  const lat = body.lat ?? FALLBACK.lat
  const lng = body.lng ?? FALLBACK.lng

  try {
    // 1) embedding de la consulta → candidatos por similitud + cercanía
    const embedding = await embedQuery(query)
    const sb = createAdminClient()
    const { data: candidates, error } = await sb.rpc('match_places', {
      p_embedding: JSON.stringify(embedding),
      p_lat: lat,
      p_lng: lng,
      p_radius_m: 25000,
      p_limit: 12,
    } as never)
    if (error) throw new Error(error.message)
    const cands = (candidates ?? []) as (Candidate & {
      slug: string; lat: number; lng: number; photo_url: string | null
    })[]
    if (!cands.length) return NextResponse.json({ picks: [] })

    // 2) el LLM elige 3 con su porqué
    const picks = await pickPlaces(query, cands)
    const byId = new Map(cands.map((c) => [c.id, c]))
    const result = picks
      .map((p) => { const c = byId.get(p.id); return c ? { ...c, reason: p.reason } : null })
      .filter(Boolean)

    return NextResponse.json({ picks: result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
