import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin-guard'
import { toCsv, csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

type Usage = {
  feature: string; model: string
  input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null
  cost_usd: number | null; user_id: string | null; business_id: string | null; created_at: string
}

// La API corta cada respuesta en 1.000 filas: sin paginar, el CSV omitía más de la mitad del
// gasto. Se recorre con .range hasta agotar (con un tope de seguridad).
const CHUNK = 1000
const MAX_ROWS = 200_000
const DAY = 86400_000
const RANGE_DAYS: Record<string, number | null> = { '7': 7, '30': 30, all: null }

export async function GET(req: NextRequest) {
  const { admin: isAdmin } = await getAdminUser()
  if (!isAdmin) return new Response('Forbidden', { status: 403 })

  // Mismo rango que la pantalla (?range=7|30|all). Sin parámetro: todo el histórico.
  const days = RANGE_DAYS[req.nextUrl.searchParams.get('range') ?? 'all'] ?? null
  const sinceIso = days ? new Date(Date.now() - days * DAY).toISOString() : null

  const admin = createAdminClient()
  const rows: Usage[] = []
  for (let from = 0; from < MAX_ROWS; from += CHUNK) {
    let query = admin
      .from('ai_usage')
      .select('feature, model, input_tokens, output_tokens, cached_tokens, cost_usd, user_id, business_id, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // desempate: orden total y estable entre páginas
      .range(from, from + CHUNK - 1)
    if (sinceIso) query = query.gte('created_at', sinceIso)
    const { data, error } = await query
    if (error) {
      console.error('[ai-costs/export]', error.message)
      return new Response('No se pudo generar el CSV', { status: 500 })
    }
    const page = (data ?? []) as Usage[]
    rows.push(...page)
    if (page.length < CHUNK) break
  }

  // Nombres por lotes (un `in` con miles de ids no cabe en la URL).
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const name: Record<string, string> = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', userIds.slice(i, i + 200))
    for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) name[p.id] = p.display_name || 'Usuario'
  }

  const csv = toCsv(
    ['fecha', 'feature', 'modelo', 'tokens_in', 'tokens_out', 'tokens_cache', 'costo_usd', 'usuario'],
    rows.map((r) => [
      r.created_at,
      r.feature,
      r.model,
      r.input_tokens ?? 0,
      r.output_tokens ?? 0,
      r.cached_tokens ?? 0,
      Number(r.cost_usd ?? 0).toFixed(6),
      r.user_id ? name[r.user_id] ?? r.user_id : '',
    ]),
  )
  return csvResponse('goospe-gastos-ia.csv', csv)
}
