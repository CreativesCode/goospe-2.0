import Link from 'next/link'
import { Clock, MapPin, MessageSquare, Type } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import { ChangeRequestButtons } from '@/features/admin/ChangeRequestButtons'
import { ProposalInbox } from '@/features/admin/ProposalInbox'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'

export const dynamic = 'force-dynamic'

type Payload = { name?: string; lat?: number | null; lng?: number | null; reference?: string | null }
type Current = { name?: string; lat?: number | null; lng?: number | null } | null
type RequestRow = {
  id: string; place_id: string; user_id: string; kind: string; status: string; message: string | null
  payload: Payload | null; current_value: Current; created_at: string; resolved_at: string | null; reject_reason: string | null
  places: { name: string; slug: string } | null
}

const COLS = 'id, place_id, user_id, kind, status, message, payload, current_value, created_at, resolved_at, reject_reason, places(name, slug)'
const fmt = (s: string | null) =>
  s ? fmtInZone(s, ADMIN_TZ, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const osm = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
const STATUS: Record<string, string> = { approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada por el dueño' }

function Coords({ label, lat, lng }: { label: string; lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return <span className="text-muted">{label}: sin coordenadas</span>
  return (
    <a href={osm(lat, lng)} target="_blank" rel="noreferrer" className="text-goospe-green hover:underline">
      {label}: {lat.toFixed(5)}, {lng.toFixed(5)}
    </a>
  )
}

// Antes -> después de lo que pide el dueño.
function Change({ r }: { r: RequestRow }) {
  if (r.kind === 'name') {
    return (
      <p className="text-sm text-fg-soft">
        <span className="line-through">{r.current_value?.name ?? '—'}</span> → <strong className="text-fg">{r.payload?.name ?? '—'}</strong>
      </p>
    )
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <Coords label="Pin actual" lat={r.current_value?.lat} lng={r.current_value?.lng} />
        <Coords label="Pin pedido" lat={r.payload?.lat} lng={r.payload?.lng} />
      </p>
      {r.payload?.reference && <p className="text-fg-soft [overflow-wrap:anywhere]">Referencia del dueño: {r.payload.reference}</p>}
    </div>
  )
}

export default async function AdminRequestsPage() {
  await requireAdmin('/admin/requests') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()

  const [pendingRes, recentRes] = await Promise.all([
    admin.from('place_change_requests').select(COLS).eq('status', 'pending').order('created_at', { ascending: true }),
    admin.from('place_change_requests').select(COLS).neq('status', 'pending').order('resolved_at', { ascending: false }).limit(15),
  ])
  const pending = (pendingRes.data ?? []) as unknown as RequestRow[]
  const recent = (recentRes.data ?? []) as unknown as RequestRow[]

  const userIds = [...new Set(pending.map((r) => r.user_id))]
  const { data: profs } = userIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const nameByUser = Object.fromEntries(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Solicitudes</h1>
        <p className="text-sm text-fg-soft">Los dueños no cambian el nombre ni el pin de su lugar por sí mismos, y tampoco crean lugares: lo piden aquí. Al rechazar, el motivo es obligatorio y se le muestra al solicitante.</p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Clock size={15} strokeWidth={1.75} /> Cambios de nombre y ubicación
          {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">No hay cambios por revisar.</div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-2xl border border-amber-300/50 bg-amber-500/5 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 font-medium text-fg-soft">
                        {r.kind === 'name' ? <><Type size={12} /> Nombre</> : <><MapPin size={12} /> Ubicación</>}
                      </span>
                      <span>{nameByUser[r.user_id] || 'Dueño'} · {fmt(r.created_at)}</span>
                    </p>
                    <Link href={`/admin/places/${r.place_id}`} className="block font-medium text-fg hover:text-goospe-green">{r.places?.name ?? 'Lugar'}</Link>
                    <Change r={r} />
                    {r.message && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-card px-3 py-2 text-sm text-fg-soft">
                        <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted" /> {r.message}
                      </p>
                    )}
                  </div>
                  <ChangeRequestButtons requestId={r.id} kind={r.kind} lat={r.payload?.lat ?? null} lng={r.payload?.lng ?? null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Cambios resueltos recientemente</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 text-fg [overflow-wrap:anywhere]">
                  {r.places?.name ?? 'Lugar'} <span className="text-muted">· {r.kind === 'name' ? `nombre → ${r.payload?.name ?? ''}` : 'ubicación'}</span>
                  {r.reject_reason && <span className="block text-xs text-fg-soft">Motivo: {r.reject_reason}</span>}
                </span>
                <span className="shrink-0 text-xs text-fg-soft">{STATUS[r.status] ?? r.status} · {fmt(r.resolved_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lugares nuevos propuestos (carga sus propios datos; el guard de arriba ya corrió). */}
      <ProposalInbox />
    </div>
  )
}
