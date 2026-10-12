// Tipos de objeto de la bitácora (audit_log.object_type). Módulo puro: lo usan src/lib/audit.ts
// (servidor) y el filtro de /admin/audit.
export const AUDIT_OBJECT_TYPES = [
  'place', 'claim', 'review', 'event', 'business', 'change_request', 'photo', 'boost', 'place_proposal',
] as const
export type AuditObjectType = (typeof AUDIT_OBJECT_TYPES)[number]
