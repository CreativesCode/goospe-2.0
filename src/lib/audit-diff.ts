// Resumen "antes / después" para audit_log: solo los campos que cambiaron y con los textos
// largos recortados (la bitácora no es una copia de la ficha).
const MAX_CHARS = 200

function brief(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === 'string') return v.length > MAX_CHARS ? `${v.slice(0, MAX_CHARS)}…` : v
  if (v && typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS)}…` : v
  }
  return v
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Campos de `after` que difieren de `before`, como { campo: { before, after } }. */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {}
  for (const key of Object.keys(after)) {
    const prev = before?.[key]
    if (!same(prev, after[key])) out[key] = { before: brief(prev), after: brief(after[key]) }
  }
  return out
}
