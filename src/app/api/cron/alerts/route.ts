import { runCronRoute } from '@/lib/cron/job-run'
import { runAlerts } from '@/lib/cron/jobs'

// Drena las alertas de reseña crítica que no salieron en el momento (ver lib/email/alerts.ts).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 60 s es el máximo del plan Hobby sin Fluid Compute. Con Fluid activo se puede subir a 300.
export const maxDuration = 60

export function GET(request: Request) {
  return runCronRoute(request, async () => [await runAlerts()])
}
