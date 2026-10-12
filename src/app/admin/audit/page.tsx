import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'
import { AUDIT_OBJECT_TYPES, type AuditObjectType } from '@/lib/audit-types'
import {
  AUDIT_ACTOR_MAX, AUDIT_PAGE_SIZE, AUDIT_PREFIXES, OBJECT_TYPE_LABEL, PREFIX_LABEL,
  auditQuery, pageCount, parseAuditFilters, payloadDiff, showValue,
} from '@/features/admin/audit-filters'

export const dynamic = 'force-dynamic'

type Row = {
  id: number; created_at: string | null; user_id: string | null; actor_email: string | null; actor_name: string | null
  action: string | null; object_type: string | null; object_id: string | null; payload: unknown
  place_id: string | null; place_name: string | null; total: number
}

const fmt = (s: string | null) =>
  s ? fmtInZone(s, ADMIN_TZ, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const field = 'rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-goospe-green'
const typeLabel = (t: string | null) => (t ? OBJECT_TYPE_LABEL[t as AuditObjectType] ?? t : '—')

// Detalle plegado: los cambios como "antes -> después" y el resto del payload como JSON.
function Payload({ payload }: { payload: unknown }) {
  const { rows, rest } = payloadDiff(payload)
  const extra = Object.keys(rest).length > 0
  if (!rows.length && !extra) return <span className="text-xs text-muted">Sin detalle</span>
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-goospe-green hover:underline">
        {rows.length ? `${rows.length} ${rows.length === 1 ? 'cambio' : 'cambios'}` : 'Ver detalle'}
      </summary>
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div key={r.field}>
              <dt className="font-medium text-fg">{r.field}</dt>
              <dd className="text-fg-soft [overflow-wrap:anywhere]">
                <span className="line-through decoration-red-500/60">{showValue(r.before)}</span>
                {' → '}
                <span className="text-fg">{showValue(r.after)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {extra && <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface p-2 text-[11px] text-fg-soft [overflow-wrap:anywhere]">{JSON.stringify(rest, null, 2)}</pre>}
    </details>
  )
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin('/admin/audit') // guard propio: el del layout no evita que la página consulte
  const filters = parseAuditFilters(await searchParams)

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('admin_audit_log', {
    ...(filters.prefix ? { p_prefix: filters.prefix } : {}),
    ...(filters.objectType ? { p_object_type: filters.objectType } : {}),
    ...(filters.actor ? { p_actor: filters.actor } : {}),
    p_limit: AUDIT_PAGE_SIZE,
    p_offset: (filters.page - 1) * AUDIT_PAGE_SIZE,
  })
  if (error) console.error('[admin/audit]', error.message)
  const rows = (data ?? []) as Row[]
  const total = Number(rows[0]?.total ?? 0)
  const pages = pageCount(total)
  const filtered = !!(filters.prefix || filters.objectType || filters.actor)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-fg">Bitácora</h1>
        <p className="text-sm text-fg-soft">Acciones sensibles de dueños y del equipo, de la más nueva a la más antigua. Las horas están en la zona del equipo ({ADMIN_TZ}).</p>
      </header>

      <form key={auditQuery(filters, 1)} method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card p-4">
        <label className="text-xs font-medium text-fg-soft">Quién
          <select name="who" defaultValue={filters.prefix?.slice(0, -1) ?? ''} className={`select-chevron mt-1 block ${field}`}>
            <option value="">Todos</option>
            {AUDIT_PREFIXES.map((p) => <option key={p} value={p.slice(0, -1)}>{PREFIX_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-fg-soft">Objeto
          <select name="type" defaultValue={filters.objectType ?? ''} className={`select-chevron mt-1 block ${field}`}>
            <option value="">Todos</option>
            {AUDIT_OBJECT_TYPES.map((t) => <option key={t} value={t}>{OBJECT_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="min-w-48 flex-1 text-xs font-medium text-fg-soft">Email o nombre del actor
          <input name="q" defaultValue={filters.actor} maxLength={AUDIT_ACTOR_MAX} placeholder="persona@correo.cl" className={`mt-1 block w-full ${field}`} />
        </label>
        <button className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-goospe-green px-5 text-sm font-medium text-white transition hover:bg-goospe-green-dark">
          <Search size={15} strokeWidth={1.75} /> Filtrar
        </button>
        {filtered && <Link href="/admin/audit" className="min-h-10 py-2 text-sm text-fg-soft hover:text-goospe-green">Limpiar</Link>}
      </form>

      {error ? (
        <p role="alert" className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">
          No pudimos leer la bitácora (¿falta aplicar la migración 0039?).
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">
          {filters.page > 1
            ? <>No hay registros en esta página. <Link href={`/admin/audit${auditQuery(filters, 1)}`} className="text-goospe-green hover:underline">Volver a la primera</Link></>
            : filtered ? 'Ningún registro coincide con el filtro.' : 'La bitácora está vacía.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-3 py-3 font-medium">Actor</th>
                <th className="px-3 py-3 font-medium">Acción</th>
                <th className="px-3 py-3 font-medium">Objeto</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-soft">{fmt(r.created_at)}</td>
                  <td className="px-3 py-3">
                    <span className="block text-fg [overflow-wrap:anywhere]">{r.actor_email ?? (r.user_id ? 'Cuenta eliminada' : 'Sistema')}</span>
                    {r.actor_name && <span className="block text-xs text-muted">{r.actor_name}</span>}
                  </td>
                  <td className="px-3 py-3"><code className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">{r.action ?? '—'}</code></td>
                  <td className="px-3 py-3">
                    <span className="block text-fg">{typeLabel(r.object_type)}</span>
                    {r.place_id
                      ? <Link href={`/admin/places/${r.place_id}`} className="block text-xs text-goospe-green hover:underline [overflow-wrap:anywhere]">{r.place_name ?? 'Ver lugar'}</Link>
                      : <span className="block font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{r.object_id ?? ''}</span>}
                  </td>
                  <td className="max-w-xs px-4 py-3"><Payload payload={r.payload} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && total > 0 && (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-soft">
          <span>{total} {total === 1 ? 'registro' : 'registros'} · página {filters.page} de {pages}</span>
          <span className="flex gap-2">
            {filters.page > 1 && (
              <Link href={`/admin/audit${auditQuery(filters, filters.page - 1)}`} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-4 hover:text-fg">
                <ChevronLeft size={15} /> Más nuevos
              </Link>
            )}
            {filters.page < pages && (
              <Link href={`/admin/audit${auditQuery(filters, filters.page + 1)}`} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-4 hover:text-fg">
                Más antiguos <ChevronRight size={15} />
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
