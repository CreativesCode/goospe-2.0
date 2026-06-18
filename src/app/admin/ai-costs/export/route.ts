import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { toCsv, csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

type Usage = {
  feature: string; model: string
  input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null
  cost_usd: number | null; user_id: string | null; business_id: string | null; created_at: string
}

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return new Response('Forbidden', { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_usage')
    .select('feature, model, input_tokens, output_tokens, cached_tokens, cost_usd, user_id, business_id, created_at')
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as Usage[]

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const { data: profs } = userIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }
  const name = Object.fromEntries(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name || 'Usuario']))

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
