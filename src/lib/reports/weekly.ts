import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { complete, type Usage } from '@/lib/ai/openai'
import type { Json } from '@/lib/database.types'

// Generación del informe semanal "tu semana en 5 líneas". Lo comparten la acción manual del
// panel (src/actions/reports.ts) y el cron (src/lib/cron/weekly.ts): mismos datos, mismo
// prompt, mismo registro de costo. SOLO llamar después de validar permiso (sesión + membresía
// en la acción; secreto del cron en la ruta).
type Admin = ReturnType<typeof createAdminClient>

const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10
const AI_TIMEOUT_MS = 15_000
const PROMPT_LABELS: Record<string, string> = {
  view_detail: 'vistas de ficha', view_card: 'apariciones en feed', save: 'guardados',
  directions: 'pidieron cómo llegar', share: 'compartieron', concierge_pick: 'recomendado por el conserje',
  call: 'llamadas', whatsapp: 'contactos por WhatsApp', rsvp: 'se apuntaron a un evento',
}

export type WeekReview = { rating: number; body: string | null }
export type WeekData = { placeName: string; metrics: Record<string, number>; reviews: WeekReview[] }

/** Lo que se guarda en business_reports.content. Sin `summary` es un resumen de números. */
export type ReportContent = {
  place_id: string
  place_name: string
  metrics: Record<string, number>
  new_reviews: number
  summary?: string
  /** Solo en el informe programado mientras la IA está escribiendo (candado). */
  pending?: boolean
}

/** Métricas y reseñas aprobadas de un lugar en el rango [fromIso, toIso). Null si el lugar no existe. */
export async function loadWeekData(admin: Admin, placeId: string, fromIso: string, toIso: string): Promise<WeekData | null> {
  const [metricsRes, placeRes, reviewsRes] = await Promise.all([
    admin.rpc('place_metrics_range', { p_place_id: placeId, p_from: fromIso, p_to: toIso }),
    admin.from('places').select('name').eq('id', placeId).maybeSingle(),
    admin.from('reviews').select('rating, body').eq('place_id', placeId).eq('status', 'approved')
      .gte('created_at', fromIso).lt('created_at', toIso).order('created_at', { ascending: false }).limit(15),
  ])
  if (metricsRes.error) throw new Error(`métricas: ${metricsRes.error.message}`)
  const place = placeRes.data as { name: string } | null
  if (!place) return null
  const metrics = Object.fromEntries(((metricsRes.data ?? []) as { kind: string; n: number }[]).map((r) => [r.kind, Number(r.n)]))
  return { placeName: place.name, metrics, reviews: (reviewsRes.data ?? []) as WeekReview[] }
}

/** Prompt del informe. Puro. */
export function buildWeeklyPrompt(d: WeekData): { system: string; user: string } {
  const metricsText = Object.entries(d.metrics).map(([k, n]) => `${PROMPT_LABELS[k] ?? k}: ${n}`).join(', ') || 'sin actividad'
  const reviewsText = d.reviews.length
    ? d.reviews.map((r) => `${r.rating}★ ${r.body ?? ''}`.trim()).join(' | ')
    : 'sin reseñas nuevas'
  const system = `Eres el analista de Goospe que le escribe a un dueño de negocio local su resumen
semanal en español chileno, cercano y directo. Máximo 5 líneas (viñetas cortas). Resalta lo bueno,
nombra una señal de alerta si la hay (ej. reseña crítica), y termina con UN consejo accionable y
concreto para la próxima semana. No inventes números: usa sólo los que te doy.`
  const user = `Negocio: ${d.placeName}
Esta semana — ${metricsText}.
Reseñas nuevas: ${reviewsText}.`
  return { system, user }
}

/** Llama a la IA (cuesta dinero) y registra el uso. Lanza si la IA falla o tarda demasiado. */
export async function writeWeeklySummary(
  admin: Admin, d: WeekData, who: { businessId: string; userId: string | null }
): Promise<string> {
  const { system, user } = buildWeeklyPrompt(d)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('la IA tardó demasiado')), AI_TIMEOUT_MS)
  })
  try {
    const { text, usage } = await Promise.race([complete(system, user, { temperature: 0.6, maxTokens: 400 }), timeout])
    const { error } = await admin.from('ai_usage').insert({
      feature: 'weekly_report', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
      cost_usd: COST(usage), user_id: who.userId, business_id: who.businessId,
    })
    if (error) console.error('[weekly-report] ai_usage:', error.message)
    return text
  } finally {
    clearTimeout(timer)
  }
}

export const contentOf = (placeId: string, d: WeekData, extra: Pick<ReportContent, 'summary' | 'pending'> = {}): ReportContent => ({
  place_id: placeId, place_name: d.placeName, metrics: d.metrics, new_reviews: d.reviews.length, ...extra,
})

/** Informe pedido a mano desde el panel: últimos 7 días hasta ahora. Se puede repetir. */
export async function createManualReport(
  admin: Admin, p: { placeId: string; businessId: string; userId: string }
): Promise<{ summary: string }> {
  const until = new Date()
  const since = new Date(until.getTime() - 7 * 86_400_000)
  const data = await loadWeekData(admin, p.placeId, since.toISOString(), until.toISOString())
  if (!data) throw new Error('Lugar no encontrado')
  const summary = await writeWeeklySummary(admin, data, { businessId: p.businessId, userId: p.userId })
  const { error } = await admin.from('business_reports').insert({
    business_id: p.businessId, place_id: p.placeId, kind: 'weekly', origin: 'manual',
    period_start: since.toISOString().slice(0, 10),
    period_end: until.toISOString().slice(0, 10),
    content: contentOf(p.placeId, data, { summary }) as unknown as Json,
  })
  if (error) console.error('[weekly-report] guardar:', error.message)
  return { summary }
}
