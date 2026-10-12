import { runCronRoute } from '@/lib/cron/job-run'
import { runAlerts, runMaintenance, runWeekly } from '@/lib/cron/jobs'

// Cron diario (el ÚNICO agendado en vercel.json: Hobby admite una ejecución al día por cron).
// En orden: mantenimiento → alertas de reseña crítica pendientes → informe semanal.
// El informe solo hace algo lunes, martes y miércoles EN LA ZONA de cada negocio (el lunes
// envía; martes y miércoles terminan lo que quedó pendiente); el resto de días es un no-op.
// Protegida con Authorization: Bearer <CRON_SECRET> (Vercel la envía sola si la variable existe).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 60 s es el máximo del plan Hobby sin Fluid Compute. Con Fluid activo se puede subir a 300.
export const maxDuration = 60

// El informe deja de empezar negocios nuevos a los 30 s: la tanda en curso (IA con tope de
// 15 s + envíos) todavía tiene que caber antes del corte de la función.
const WEEKLY_BUDGET_MS = 30_000

export function GET(request: Request) {
  return runCronRoute(request, async () => {
    const deadline = Date.now() + WEEKLY_BUDGET_MS
    // Secuencial: cada tarea deja su fila en job_runs y un fallo no impide las siguientes.
    return [await runMaintenance(), await runAlerts(), await runWeekly(deadline)]
  })
}
