'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'
import { complete, type Usage } from '@/lib/ai/openai'

const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10
const LABELS: Record<string, string> = {
  view_detail: 'vistas de ficha', view_card: 'apariciones en feed', save: 'guardados',
  directions: 'pidieron cómo llegar', share: 'compartieron', concierge_pick: 'recomendado por el conserje',
}

// Informe semanal IA "tu semana en 5 líneas": resume métricas + reseñas recientes con un
// consejo accionable. Se muestra en el panel y se guarda en business_reports (sin email aún).
export async function generateWeeklyReport(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 7 * 86400_000)
  const [{ data: metricsRows }, { data: place }, { data: reviews }] = await Promise.all([
    admin.rpc('place_metrics', { p_place_id: placeId, p_days: 7 } as never),
    admin.from('places').select('name').eq('id', placeId).single(),
    admin.from('reviews').select('rating, body').eq('place_id', placeId).eq('status', 'approved')
      .gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(15),
  ])
  const metrics = Object.fromEntries(((metricsRows ?? []) as { kind: string; n: number }[]).map((r) => [r.kind, Number(r.n)]))
  const revs = (reviews ?? []) as { rating: number; body: string | null }[]
  const placeName = (place as { name: string }).name

  const metricsText = Object.entries(metrics).map(([k, n]) => `${LABELS[k] ?? k}: ${n}`).join(', ') || 'sin actividad'
  const reviewsText = revs.length
    ? revs.map((r) => `${r.rating}★ ${r.body ?? ''}`.trim()).join(' | ')
    : 'sin reseñas nuevas'

  const system = `Eres el analista de Goospe que le escribe a un dueño de negocio local su resumen
semanal en español chileno, cercano y directo. Máximo 5 líneas (viñetas cortas). Resalta lo bueno,
nombra una señal de alerta si la hay (ej. reseña crítica), y termina con UN consejo accionable y
concreto para la próxima semana. No inventes números: usa sólo los que te doy.`
  const userMsg = `Negocio: ${placeName}
Esta semana — ${metricsText}.
Reseñas nuevas: ${reviewsText}.`

  try {
    const { text, usage } = await complete(system, userMsg, { temperature: 0.6, maxTokens: 400 })
    const periodEnd = new Date()
    await admin.from('business_reports').insert({
      business_id: businessId, kind: 'weekly',
      period_start: since.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      content: { summary: text, metrics, place_id: placeId, place_name: placeName },
    } as never)
    void admin.from('ai_usage').insert({
      feature: 'weekly_report', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
      cost_usd: COST(usage), user_id: user.id, business_id: businessId,
    } as never)
    revalidatePath(`/panel/${placeId}`)
    return { success: true, summary: text }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
