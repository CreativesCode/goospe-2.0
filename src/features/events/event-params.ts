// Parámetros de la cartelera (/events?when=hoy&city=puerto-varas). Lógica pura, con tests
// (tests/event-params.test.ts): la página NUNCA debe fallar por la query string.

import { z } from 'zod'
import { isSlug } from '@/features/places/seo-routes'
import { parseEventWindow, type EventWindow } from './event-time'

/** `?city=todas`: ver todas las ciudades aunque el visitante tenga una ciudad elegida. */
export const ALL_CITIES = 'todas'

// Next entrega `string | string[] | undefined` por clave: de un valor repetido cuenta el primero.
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

// OJO (Zod 4): `z.unknown()` dentro de `z.object` hace la clave OBLIGATORIA, así que
// `z.unknown().transform(...)` lanzaba "expected nonoptional" cuando faltaba `when` o `city`
// (la cartelera solo abría con los dos en la URL). El `.optional()` va ANTES del transform.
export const eventsParamsSchema = z.object({
  when: z.unknown().optional().transform((v) => parseEventWindow(first(v))),
  city: z.unknown().optional().transform((v) => {
    const value = first(v)
    return isSlug(value) ? value : null
  }),
})

/** `city`: slug pedido, `ALL_CITIES` ("todas") o null si no viene (o no tiene forma de slug). */
export type EventsParams = z.infer<typeof eventsParamsSchema>

const DEFAULTS: EventsParams = { when: 'proximos', city: null }

/** Lee los searchParams de la cartelera. Cualquier entrada rara cae a los valores por defecto. */
export function parseEventsParams(raw: unknown): EventsParams {
  const parsed = eventsParamsSchema.safeParse(raw && typeof raw === 'object' ? raw : {})
  return parsed.success ? parsed.data : DEFAULTS
}

/** URL de la cartelera: "Próximos" y "sin ciudad" son los valores por defecto y no se escriben. */
export function eventsHref(when: EventWindow, city: string | null): string {
  const q = new URLSearchParams()
  if (when !== 'proximos') q.set('when', when)
  if (city) q.set('city', city)
  const qs = q.toString()
  return qs ? `/events?${qs}` : '/events'
}
