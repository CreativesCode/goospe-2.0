import { z } from 'zod'

// UUID en formato canónico (cualquier versión). Regex propia: el z.uuid() de Zod 4 exige
// versión RFC y rechazaría ids válidos de Postgres generados por otros medios.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const uuidSchema = z.string().regex(UUID_RE)
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
