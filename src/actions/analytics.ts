'use server'

import { z } from 'zod'
import { requireOwner } from '@/lib/owner-guard'
import { rateLimit } from '@/lib/rate-limit'
import { uuidSchema } from '@/lib/validation'
import { loadPlaceSeries } from '@/features/analytics/load'
import { GROUPS, RANGES } from '@/features/analytics/metrics'

const querySchema = z.object({
  placeId: uuidSchema,
  days: z.union(RANGES.map((d) => z.literal(d))),
  group: z.enum(GROUPS),
})

/** Serie del panel de estadísticas al cambiar de rango o de agrupación. */
export async function getPlaceSeries(input: { placeId: string; days: number; group: string }) {
  const parsed = querySchema.safeParse(input)
  if (!parsed.success) return { error: 'Consulta inválida' }
  const ctx = await requireOwner(parsed.data.placeId)
  if ('error' in ctx) return { error: ctx.error }
  if (!(await rateLimit(`stats:${ctx.user.id}`, 60, 60))) return { error: 'Vas muy rápido. Espera un momento.' }

  const res = await loadPlaceSeries(ctx.placeId, parsed.data.days, parsed.data.group)
  if (!res.ok) return { error: 'No pudimos cargar las estadísticas. Intenta de nuevo.' }
  return { rows: res.rows }
}
