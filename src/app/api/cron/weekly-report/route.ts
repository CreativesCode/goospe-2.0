import { runCronRoute } from '@/lib/cron/job-run'
import { runWeekly } from '@/lib/cron/jobs'

// Informe semanal programado, suelto (para dispararlo a mano o desde otro agendador).
// Es idempotente por negocio + lugar + semana: repetirlo no regenera ni reenvía.
// CUESTA DINERO (OpenAI) y ENVÍA EMAILS reales cuando hay proveedor configurado.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 60 s es el máximo del plan Hobby sin Fluid Compute. Con Fluid activo se puede subir a 300.
export const maxDuration = 60

// Deja de empezar negocios nuevos a los 35 s; la tanda en curso termina antes del corte.
const BUDGET_MS = 35_000

export function GET(request: Request) {
  return runCronRoute(request, async () => [await runWeekly(Date.now() + BUDGET_MS)])
}
