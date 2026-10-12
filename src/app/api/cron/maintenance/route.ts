import { runCronRoute } from '@/lib/cron/job-run'
import { runMaintenance } from '@/lib/cron/jobs'

// Mantenimiento: respaldo del job de pg_cron 'goospe-maintenance' (0040). Hoy no hay ninguna
// tarea de mantenimiento que necesite Node: todo es SQL y vive en run_maintenance().
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 60 s es el máximo del plan Hobby sin Fluid Compute. Con Fluid activo se puede subir a 300.
export const maxDuration = 60

export function GET(request: Request) {
  return runCronRoute(request, async () => [await runMaintenance()])
}
