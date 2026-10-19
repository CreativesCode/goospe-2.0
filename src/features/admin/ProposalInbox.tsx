import Link from 'next/link'
import { AlertTriangle, Clock, Globe, MapPinPlus, MessageSquare, Phone } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'
import { ProposalButtons } from '@/features/admin/ProposalButtons'
import { loadProposalDuplicates, PROPOSAL_COLS, type ProposalRow } from '@/features/admin/proposal-data'
import { formatDistance, type RankedDuplicate } from '@/features/admin/proposal-duplicates'

const fmt = (s: string | null) =>
  s ? fmtInZone(s, ADMIN_TZ, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const osm = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())
const STATUS: Record<string, string> = { approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada por el solicitante' }

function Duplicates({ checked, rows }: { checked: boolean; rows: RankedDuplicate[] }) {
  if (!checked) {
    return <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-fg">No pudimos comprobar si el lugar ya existe. Búscalo en Lugares antes de aprobar.</p>
  }
  if (!rows.length) return <p className="text-xs text-muted">Sin lugares parecidos cerca ni con ese nombre.</p>
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        <AlertTriangle size={14} strokeWidth={2} className="text-amber-700 dark:text-amber-400" /> Posibles duplicados
      </p>
      <ul className="mt-1 space-y-1 text-sm">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-2">
            <Link href={`/admin/places/${d.id}`} className="font-medium text-fg hover:text-ink">{d.name}</Link>
            <span className="text-xs text-fg-soft">
              {formatDistance(d.distance_m)} · nombre {Math.round(d.similarity * 100)} % parecido
              {d.city_name ? ` · ${d.city_name}` : ''}{d.claimed ? ' · con dueño' : ''}{d.is_published ? '' : ' · oculto'}
            </span>
            {d.level === 'high' && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">Muy probable</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Sección "Lugares propuestos" de /admin/requests. SOLO renderizar después de requireAdmin():
 * lee con service role. Antes de aprobar muestra los lugares cercanos o de nombre parecido.
 */
export async function ProposalInbox() {
  const admin = createAdminClient()
  const [pendingRes, recentRes, citiesRes] = await Promise.all([
    admin.from('place_proposals').select(PROPOSAL_COLS).eq('status', 'pending').order('created_at', { ascending: true }),
    admin.from('place_proposals').select(PROPOSAL_COLS).neq('status', 'pending').order('resolved_at', { ascending: false }).limit(15),
    admin.from('cities').select('id, name').order('name'),
  ])
  if (pendingRes.error) {
    console.error('[ProposalInbox]', pendingRes.error.message)
    return (
      <section id="propuestas" className="scroll-mt-24 rounded-2xl border border-dashed border-line bg-card px-5 py-6 text-sm text-fg-soft">
        No pudimos cargar los lugares propuestos (¿falta aplicar la migración 0039?).
      </section>
    )
  }
  const pending = (pendingRes.data ?? []) as unknown as ProposalRow[]
  const recent = (recentRes.data ?? []) as unknown as ProposalRow[]
  const cities = (citiesRes.data ?? []) as { id: number; name: string }[]

  const userIds = [...new Set(pending.map((p) => p.user_id))]
  const [{ data: profs }, dups] = await Promise.all([
    userIds.length
      ? admin.from('profiles').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    Promise.all(pending.map((p) => loadProposalDuplicates(admin, { name: p.name, lat: p.lat, lng: p.lng, cityId: p.city_id }))),
  ])
  const nameByUser = Object.fromEntries(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]))

  return (
    <>
      <section id="propuestas" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <MapPinPlus size={15} strokeWidth={1.75} /> Lugares propuestos
          {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">No hay lugares propuestos por revisar.</div>
        ) : (
          <ul className="space-y-3">
            {pending.map((p, i) => {
              const dup = dups[i]
              const ref = p.location_ref?.trim() ?? ''
              return (
                <li key={p.id} className="rounded-2xl border border-amber-300/50 bg-amber-500/5 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 basis-64 space-y-2">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 font-medium text-fg-soft">
                          {p.categories ? `${p.categories.emoji ? `${p.categories.emoji} ` : ''}${p.categories.name}` : 'Sin categoría'}
                        </span>
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {nameByUser[p.user_id] || 'Solicitante'} · {fmt(p.created_at)}</span>
                      </p>
                      <p className="font-medium text-fg [overflow-wrap:anywhere]">{p.name}</p>
                      <p className="text-sm text-fg-soft [overflow-wrap:anywhere]">{[p.address, p.city_name].filter(Boolean).join(', ') || 'Sin dirección'}</p>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {p.lat !== null && p.lng !== null ? (
                          <a href={osm(p.lat, p.lng)} target="_blank" rel="noreferrer" className="text-ink hover:underline">Pin propuesto: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</a>
                        ) : <span className="text-muted">Sin coordenadas: ubica el pin con la referencia</span>}
                        {p.phone && <span className="inline-flex items-center gap-1 text-fg-soft"><Phone size={12} /> {p.phone}</span>}
                        {p.website && <a href={p.website} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-fg-soft hover:text-ink"><Globe size={12} /> Sitio web</a>}
                      </p>
                      {ref && (
                        <p className="text-sm text-fg-soft [overflow-wrap:anywhere]">
                          Referencia: {isUrl(ref) ? <a href={ref} target="_blank" rel="noreferrer nofollow" className="text-ink hover:underline">{ref}</a> : ref}
                        </p>
                      )}
                      {p.message && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-card px-3 py-2 text-sm text-fg-soft">
                          <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted" /> {p.message}
                        </p>
                      )}
                      <Duplicates checked={dup.ok} rows={dup.rows} />
                    </div>
                    <ProposalButtons proposalId={p.id} lat={p.lat} lng={p.lng} cityId={p.city_id} cities={cities} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Propuestas resueltas recientemente</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 text-fg [overflow-wrap:anywhere]">
                  {p.place_id ? <Link href={`/admin/places/${p.place_id}`} className="hover:text-ink">{p.name}</Link> : p.name}
                  {p.city_name && <span className="text-muted"> · {p.city_name}</span>}
                  {p.reject_reason && <span className="block text-xs text-fg-soft">Motivo: {p.reject_reason}</span>}
                </span>
                <span className="shrink-0 text-xs text-fg-soft">{STATUS[p.status] ?? p.status} · {fmt(p.resolved_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
