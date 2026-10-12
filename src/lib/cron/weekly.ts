import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import { numbersDigestEmail, weeklyReportEmail, type ReportPlace } from '@/emails/reports'
import { absoluteUrl, emailProvider } from '@/lib/email/config'
import { subscribedUsers } from '@/lib/email/preferences'
import { businessMemberIds, recipientsOf } from '@/lib/email/recipients'
import { sendEmail } from '@/lib/email/send'
import type { JobCounts } from '@/lib/cron/job-run'
import { contentOf, loadWeekData, writeWeeklySummary, type ReportContent } from '@/lib/reports/weekly'
import { activityTotal, isWeeklyRunDay, lastClosedWeek, periodLabel, weeklyEmailKey, type WeekPeriod } from '@/lib/reports/week'

// Informe semanal programado: por cada negocio con al menos un lugar publicado y un miembro,
// genera el informe de la semana cerrada y lo envía por email.
//
// COSTO (cada informe con IA es una llamada a OpenAI):
//   · sin proveedor de email no se genera nada (el informe programado existe para enviarse);
//   · un lugar sin actividad en la semana no genera informe ni email;
//   · si nadie del negocio quiere el informe con IA, no se llama a la IA (va el resumen de
//     números a quien lo tenga activo);
//   · tope de informes con IA por ejecución (WEEKLY_REPORT_MAX_AI); pasado el tope, o si la IA
//     falla, ese lugar va como resumen de números.
//
// IDEMPOTENCIA: la fila de business_reports se inserta ANTES de llamar a la IA y es única por
// negocio + lugar + semana (business_reports_scheduled_uidx). Un cron reintentado, o dos a la
// vez, no regeneran: el segundo choca con el índice. El email lleva su propia clave única por
// negocio + semana + destinatario (email_log). Reejecutar solo termina lo que faltaba.

type Admin = ReturnType<typeof createAdminClient>

const DEFAULT_MAX_AI = 25
const MAX_PLACES_PER_BUSINESS = 5
const PAGE = 200
const PARALLEL = 4
/** Una fila "pendiente" más vieja que esto es de una ejecución que murió: se envía sin IA. */
const STALE_PENDING_MS = 30 * 60_000

type Business = { id: string; name: string }
type PlaceRow = { id: string; name: string; cities: { timezone: string } | null }
type ReportRow = { id: string; place_id: string | null; content: ReportContent | null; sent_at: string | null; created_at: string | null }
type Budget = { ai: number }
type Tally = Record<'businesses' | 'ai_reports' | 'digests' | 'emails_sent' | 'emails_skipped' | 'emails_failed' | 'inactive' | 'already_done' | 'not_today' | 'errors', number>

export function maxAiReports(raw = process.env.WEEKLY_REPORT_MAX_AI): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_MAX_AI
}

const asJson = (c: ReportContent) => c as unknown as Json

// Informe de un lugar para la semana: reutiliza el guardado o lo crea (con IA si corresponde).
// Devuelve null si no hay nada que enviar o 'busy' si otra ejecución lo está escribiendo.
async function placeReport(
  admin: Admin, b: Business, place: PlaceRow, period: WeekPeriod, existing: ReportRow | undefined,
  wantAi: boolean, budget: Budget, tally: Tally
): Promise<ReportRow | 'busy' | null> {
  if (existing) {
    if (!existing.content?.pending) return existing
    const age = Date.now() - new Date(existing.created_at ?? 0).getTime()
    if (age < STALE_PENDING_MS) return 'busy'
    // Quedó a medias: se cierra como resumen de números, sin volver a llamar a la IA.
    const content = { ...existing.content, pending: false }
    await admin.from('business_reports').update({ content: asJson(content) }).eq('id', existing.id)
    return { ...existing, content }
  }

  const data = await loadWeekData(admin, place.id, period.fromIso, period.toIso)
  if (!data || activityTotal(data.metrics, data.reviews.length) === 0) return null

  const useAi = wantAi && budget.ai > 0 && !!process.env.OPENAI_API_KEY
  if (useAi) budget.ai-- // se descuenta antes de esperar: las tandas en paralelo comparten el tope
  const draft = contentOf(place.id, data, useAi ? { pending: true } : {})
  const { data: created, error } = await admin.from('business_reports').insert({
    business_id: b.id, place_id: place.id, kind: 'weekly', origin: 'scheduled',
    period_start: period.start, period_end: period.end, content: asJson(draft),
  }).select('id, place_id, content, sent_at, created_at').single()
  if (error || !created) {
    if (useAi) budget.ai++
    if (error?.code === '23505') return 'busy' // otra ejecución tomó este lugar
    throw new Error(`guardar informe: ${error?.message}`)
  }
  const row = created as unknown as ReportRow
  if (!useAi) {
    tally.digests++
    return row
  }

  let content: ReportContent
  try {
    const summary = await writeWeeklySummary(admin, data, { businessId: b.id, userId: null })
    content = contentOf(place.id, data, { summary })
    tally.ai_reports++
  } catch (e) {
    // La IA falló: el lugar va con sus números. No se reintenta (no regenerar es la regla).
    console.error(`[weekly] IA (${place.id}):`, (e as Error).message)
    content = contentOf(place.id, data)
    tally.digests++
    tally.errors++
  }
  await admin.from('business_reports').update({ content: asJson(content) }).eq('id', row.id)
  return { ...row, content }
}

async function processBusiness(admin: Admin, b: Business, now: Date, budget: Budget, tally: Tally): Promise<void> {
  const { data: placeRows, error: placesErr } = await admin.from('places')
    .select('id, name, cities(timezone)').eq('business_id', b.id).eq('is_published', true)
    .order('name').limit(MAX_PLACES_PER_BUSINESS)
  if (placesErr) throw new Error(`lugares: ${placesErr.message}`)
  const places = (placeRows ?? []) as unknown as PlaceRow[]
  if (!places.length) return

  // La semana se corta en la zona horaria de la ciudad del negocio (la de su primer lugar).
  const period = lastClosedWeek(now, places[0].cities?.timezone)
  if (!isWeeklyRunDay(period.weekday)) {
    tally.not_today++
    return
  }
  const members = await businessMemberIds(b.id, admin)
  if (!members.length) return
  tally.businesses++

  const { data: reportRows, error: reportsErr } = await admin.from('business_reports')
    .select('id, place_id, content, sent_at, created_at')
    .eq('business_id', b.id).eq('kind', 'weekly').eq('origin', 'scheduled').eq('period_start', period.start)
  if (reportsErr) throw new Error(`informes: ${reportsErr.message}`)
  const existing = (reportRows ?? []) as unknown as ReportRow[]
  if (existing.some((r) => r.sent_at)) {
    tally.already_done++
    return
  }

  const [wantsReport, wantsDigest] = await Promise.all([
    subscribedUsers(members, 'weekly_report', admin),
    subscribedUsers(members, 'digest', admin),
  ])
  if (!wantsReport || !wantsDigest) throw new Error('preferencias no disponibles')
  if (!wantsReport.size && !wantsDigest.size) return // todos se dieron de baja: ni IA ni email

  const reports: ReportRow[] = []
  for (const place of places) {
    const r = await placeReport(admin, b, place, period, existing.find((e) => e.place_id === place.id), wantsReport.size > 0, budget, tally)
    if (r === 'busy') return // otra ejecución está con este negocio: ella envía
    if (r) reports.push(r)
  }
  if (!reports.length) {
    tally.inactive++
    return
  }

  const sections: ReportPlace[] = reports.flatMap((r) => (r.content ? [{
    name: r.content.place_name, summary: r.content.summary ?? null, metrics: r.content.metrics,
    newReviews: r.content.new_reviews, panelUrl: absoluteUrl(`/panel/${r.content.place_id}`),
  }] : []))
  const hasSummary = sections.some((s) => s.summary)
  const props = {
    businessName: b.name, periodLabel: periodLabel(period.start, period.end), places: sections,
    panelUrl: sections.length === 1 ? sections[0].panelUrl : absoluteUrl('/panel'),
  }

  let delivered = false
  for (const r of await recipientsOf([...new Set([...wantsReport, ...wantsDigest])], admin)) {
    // Informe con IA si lo quiere y existe; si no, resumen de números si lo quiere; si no, nada.
    const withAi = hasSummary && wantsReport.has(r.userId)
    if (!withAi && !wantsDigest.has(r.userId)) continue
    const res = await sendEmail({
      to: r.email, userId: r.userId,
      template: withAi ? 'weekly_report' : 'numbers_digest',
      category: withAi ? 'weekly_report' : 'digest',
      dedupeKey: weeklyEmailKey(b.id, period.start, r.userId),
      meta: { business_id: b.id, period_start: period.start },
      render: ({ unsubscribeUrl }) => (withAi ? weeklyReportEmail : numbersDigestEmail)({ ...props, unsubscribeUrl }),
    })
    if (res.status === 'sent') { tally.emails_sent++; delivered = true }
    else if (res.status === 'failed') tally.emails_failed++
    else tally.emails_skipped++
  }

  // sent_at solo si salió al menos un email: lo que quedó sin enviar se reintenta el día siguiente.
  if (delivered) {
    await admin.from('business_reports').update({ sent_at: new Date().toISOString() }).in('id', reports.map((r) => r.id))
  }
}

export async function runWeeklyReports(opts: { deadline: number; now?: Date }): Promise<JobCounts> {
  if (!emailProvider()) return { skipped: 'no_provider' }
  const admin = createAdminClient()
  const now = opts.now ?? new Date()
  const budget: Budget = { ai: maxAiReports() }
  const tally: Tally = { businesses: 0, ai_reports: 0, digests: 0, emails_sent: 0, emails_skipped: 0, emails_failed: 0, inactive: 0, already_done: 0, not_today: 0, errors: 0 }
  let stopped = false

  // Por páginas (tope de 1.000 filas de la API) y en tandas pequeñas en paralelo, mirando el
  // reloj antes de cada tanda: lo que no alcance hoy lo retoma la ejecución de mañana.
  for (let from = 0; !stopped; from += PAGE) {
    const { data, error } = await admin.from('businesses').select('id, name').order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`negocios: ${error.message}`)
    const page = (data ?? []) as Business[]
    for (let i = 0; i < page.length; i += PARALLEL) {
      if (Date.now() >= opts.deadline) {
        stopped = true
        break
      }
      await Promise.all(page.slice(i, i + PARALLEL).map((b) =>
        processBusiness(admin, b, now, budget, tally).catch((e: unknown) => {
          tally.errors++
          console.error(`[weekly] negocio ${b.id}:`, (e as Error).message)
        })
      ))
    }
    if (page.length < PAGE) break
  }
  return { ...tally, ai_budget_left: budget.ai, stopped_by_time: stopped }
}
