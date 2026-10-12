import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCriticalReviewAlerts } from '@/lib/email/alerts'
import { withJobRun, type JobCounts, type JobResult } from '@/lib/cron/job-run'
import { runWeeklyReports } from '@/lib/cron/weekly'

// Tareas del cron diario. Cada una deja su propia fila en job_runs y ninguna tumba a las demás.

/**
 * Mantenimiento puro SQL (boosts vencidos, rate_limits, registros antiguos). Quien lo agenda es
 * pg_cron cada noche (0040); esta llamada es el RESPALDO por si pg_cron no corrió: la función
 * es idempotente, así que ejecutarla dos veces el mismo día no cambia nada.
 */
export function runMaintenance(): Promise<JobResult> {
  return withJobRun('maintenance', async () => {
    const { data, error } = await createAdminClient().rpc('run_maintenance')
    if (error) throw new Error(error.message)
    return (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as JobCounts
  })
}

/** Red de seguridad de las alertas de reseña crítica que no salieron en el momento. */
export function runAlerts(): Promise<JobResult> {
  return withJobRun('alerts', async () => ({ ...(await sendCriticalReviewAlerts()) }))
}

/** Informe semanal. `deadline` (ms epoch): deja de empezar negocios nuevos pasado ese instante. */
export function runWeekly(deadline: number): Promise<JobResult> {
  return withJobRun('weekly-report', () => runWeeklyReports({ deadline }))
}
