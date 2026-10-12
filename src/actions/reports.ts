'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/owner-guard'
import { rateLimit } from '@/lib/rate-limit'
import { createManualReport } from '@/lib/reports/weekly'

const REPORTS_PER_HOUR = 6

// Informe semanal IA "tu semana en 5 líneas", pedido a mano desde el panel: resume métricas +
// reseñas recientes con un consejo accionable y se guarda en business_reports (origin
// 'manual'). La generación es la misma que usa el envío programado de los lunes
// (src/lib/reports/weekly.ts); aquí solo van el permiso y el tope.
export async function generateWeeklyReport(formData: FormData) {
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }
  // Cada informe cuesta una llamada a la IA: tope por usuario, y si el contador no responde se rechaza.
  if (!(await rateLimit(`weekly-report:${ctx.user.id}`, 3600, REPORTS_PER_HOUR, { failOpen: false }))) {
    return { error: 'Ya generaste varios informes seguidos. Intenta de nuevo en un rato.' }
  }

  try {
    const { summary } = await createManualReport(createAdminClient(), {
      placeId: ctx.placeId, businessId: ctx.businessId, userId: ctx.user.id,
    })
    revalidatePath(`/panel/${ctx.placeId}`)
    return { success: true, summary }
  } catch (e) {
    console.error('[generateWeeklyReport]', (e as Error).message)
    return { error: 'No pudimos generar el informe. Intenta de nuevo en un rato.' }
  }
}
