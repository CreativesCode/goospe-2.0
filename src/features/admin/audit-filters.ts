import { AUDIT_OBJECT_TYPES, type AuditObjectType } from '@/lib/audit-types'

// Filtros y presentación de /admin/audit. Lógica pura: lo que llega por la URL nunca se
// pasa tal cual a la consulta (prefijo y tipo salen de listas cerradas; el texto se recorta).

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_ACTOR_MAX = 100
const MAX_PAGE = 10_000

export const AUDIT_PREFIXES = ['owner.', 'admin.'] as const
export type AuditPrefix = (typeof AUDIT_PREFIXES)[number]
export const PREFIX_LABEL: Record<AuditPrefix, string> = { 'owner.': 'Dueños', 'admin.': 'Equipo (admin)' }
export const OBJECT_TYPE_LABEL: Record<AuditObjectType, string> = {
  place: 'Lugar', claim: 'Reclamo', review: 'Reseña', event: 'Evento', business: 'Negocio',
  change_request: 'Solicitud de cambio', photo: 'Foto', boost: 'Destacado', place_proposal: 'Lugar propuesto',
}

export type AuditFilters = {
  prefix: AuditPrefix | null
  objectType: AuditObjectType | null
  /** Texto libre sobre el email o el nombre del actor. */
  actor: string
  page: number
}

type Param = string | string[] | undefined
const first = (v: Param): string => (Array.isArray(v) ? v[0] : v) ?? ''

/** searchParams de la página -> filtros válidos (lo desconocido se ignora, no da error). */
export function parseAuditFilters(sp: Record<string, Param>): AuditFilters {
  const who = first(sp.who).trim().toLowerCase()
  const prefix = AUDIT_PREFIXES.find((p) => p === who || p === `${who}.`) ?? null
  const type = first(sp.type).trim()
  const objectType = AUDIT_OBJECT_TYPES.find((t) => t === type) ?? null
  const actor = first(sp.q).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, AUDIT_ACTOR_MAX)
  const n = Number(first(sp.page))
  const page = Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGE) : 1
  return { prefix, objectType, actor, page }
}

/** Query string de la bitácora con esos filtros (para la paginación y los enlaces). */
export function auditQuery(f: AuditFilters, page: number = f.page): string {
  const q = new URLSearchParams()
  if (f.prefix) q.set('who', f.prefix.slice(0, -1))
  if (f.objectType) q.set('type', f.objectType)
  if (f.actor) q.set('q', f.actor)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pageCount = (total: number, size: number = AUDIT_PAGE_SIZE): number =>
  Math.max(1, Math.ceil(Math.max(total, 0) / size))

export type DiffRow = { field: string; before: unknown; after: unknown }

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const hasBeforeAfter = (v: unknown): v is { before: unknown; after: unknown } =>
  isRecord(v) && ('before' in v || 'after' in v) && Object.keys(v).every((k) => k === 'before' || k === 'after')

/**
 * Filas "antes -> después" de un payload de la bitácora. Reconoce las dos formas que escribe
 * el código: { campo: { before, after } } (diffFields) y { before, after } con valores u
 * objetos. Lo que no es un cambio (ids, motivos…) va en `rest`.
 */
export function payloadDiff(payload: unknown): { rows: DiffRow[]; rest: Record<string, unknown> } {
  const rows: DiffRow[] = []
  const rest: Record<string, unknown> = {}
  if (!isRecord(payload)) return { rows, rest }

  if ('before' in payload || 'after' in payload) {
    const { before, after, ...others } = payload
    if (isRecord(before) || isRecord(after)) {
      const b = isRecord(before) ? before : {}
      const a = isRecord(after) ? after : {}
      for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
        rows.push({ field, before: b[field] ?? null, after: a[field] ?? null })
      }
    } else {
      rows.push({ field: 'valor', before: before ?? null, after: after ?? null })
    }
    Object.assign(rest, others)
    return { rows, rest }
  }

  for (const [field, value] of Object.entries(payload)) {
    if (hasBeforeAfter(value)) rows.push({ field, before: value.before ?? null, after: value.after ?? null })
    else rest[field] = value
  }
  return { rows, rest }
}

/** Valor de la bitácora como texto corto para una celda. */
export function showValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'number') return String(v)
  return JSON.stringify(v)
}
