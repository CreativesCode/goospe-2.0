import Link from 'next/link'
import { BadgeCheck, Store, Clock, Mail, Phone, MessageSquare } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { UnclaimButton } from '@/features/admin/UnclaimButton'
import { ClaimReviewButtons } from '@/features/admin/ClaimReviewButtons'

export const dynamic = 'force-dynamic'

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtFull = (s: string | null) => (s ? new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

type PlaceRow = { id: string; name: string; slug: string; business_id: string | null; is_published: boolean | null }
type Evidence = { contact_name?: string | null; phone?: string | null; email?: string | null; message?: string | null } | null
type PendingClaim = { id: string; place_id: string; user_id: string; created_at: string; evidence: Evidence }

export default async function AdminClaimsPage() {
  const admin = createAdminClient()

  // Cola de moderación: solicitudes de reclamo pendientes (nadie es dueño hasta aprobarlas).
  const { data: pendingData } = await admin
    .from('claims')
    .select('id, place_id, user_id, created_at, evidence')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const pending = (pendingData ?? []) as PendingClaim[]

  const pendPlaceIds = [...new Set(pending.map((c) => c.place_id))]
  const pendUserIds = [...new Set(pending.map((c) => c.user_id))]
  const [pendPlacesRes, pendProfilesRes] = await Promise.all([
    pendPlaceIds.length
      ? admin.from('places').select('id, name, slug, address, place_categories(categories(name, emoji))').in('id', pendPlaceIds)
      : Promise.resolve({ data: [] as unknown[] }),
    pendUserIds.length
      ? admin.from('profiles').select('id, display_name').in('id', pendUserIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendPlaceById = Object.fromEntries(((pendPlacesRes.data ?? []) as any[]).map((p) => [p.id, p]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendNameByUser = Object.fromEntries(((pendProfilesRes.data ?? []) as any[]).map((p) => [p.id, p.display_name]))

  const { data: placesData } = await admin
    .from('places')
    .select('id, name, slug, business_id, is_published')
    .eq('claimed', true)
    .order('name')
  const places = (placesData ?? []) as PlaceRow[]

  const bizIds = [...new Set(places.map((p) => p.business_id).filter(Boolean))] as string[]
  const placeIds = places.map((p) => p.id)

  const [members, claims] = await Promise.all([
    bizIds.length
      ? admin.from('business_members').select('business_id, role, profiles(id, display_name)').in('business_id', bizIds).eq('role', 'owner')
      : Promise.resolve({ data: [] as unknown[] }),
    placeIds.length
      ? admin.from('claims').select('place_id, created_at, status, method').in('place_id', placeIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerByBiz = Object.fromEntries(((members.data ?? []) as any[]).map((m) => [m.business_id, m.profiles]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claimByPlace = Object.fromEntries(((claims.data ?? []) as any[]).map((c) => [c.place_id, c]))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Reclamos</h1>
        <p className="text-sm text-fg-soft">Revisa cada solicitud de forma personal antes de dar acceso, y administra los lugares ya reclamados.</p>
      </header>

      {/* Cola de moderación: solicitudes pendientes */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <Clock size={15} strokeWidth={1.75} /> Solicitudes pendientes
          </h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700">{pending.length}</span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">
            No hay solicitudes por revisar.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((c) => {
              const place = pendPlaceById[c.place_id]
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cats = ((place?.place_categories ?? []) as any[]).map((pc) => pc.categories).filter(Boolean)
              const city = (place?.address as { city?: string } | null)?.city
              const ev = c.evidence ?? {}
              const requester = ev.contact_name || pendNameByUser[c.user_id] || 'Solicitante'
              return (
                <li key={c.id} className="rounded-2xl border border-amber-300/50 bg-amber-50/40 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <Link href={place ? `/admin/places/${c.place_id}` : '#'} className="font-medium text-fg hover:text-goospe-green">
                          {place?.name ?? 'Lugar'}
                        </Link>
                        <p className="text-xs text-muted">
                          {cats.map((cat: { emoji?: string; name: string }) => cat.name).join(' · ') || 'Sin categoría'}
                          {city ? ` · ${city}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-soft">
                        <span className="inline-flex items-center gap-1 font-medium text-fg"><BadgeCheck size={13} className="text-goospe-green" /> {requester}</span>
                        {ev.phone && <a href={`tel:${ev.phone}`} className="inline-flex items-center gap-1 hover:text-goospe-green"><Phone size={12} /> {ev.phone}</a>}
                        {ev.email && <a href={`mailto:${ev.email}`} className="inline-flex items-center gap-1 hover:text-goospe-green"><Mail size={12} /> {ev.email}</a>}
                        <span className="inline-flex items-center gap-1 text-muted"><Clock size={12} /> {fmtFull(c.created_at)}</span>
                      </div>
                      {ev.message && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-card px-3 py-2 text-sm text-fg-soft">
                          <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted" /> {ev.message}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <ClaimReviewButtons claimId={c.id} placeName={place?.name ?? 'este lugar'} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          {places.length} {places.length === 1 ? 'lugar reclamado' : 'lugares reclamados'}
        </h2>

      {places.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green"><Store size={26} strokeWidth={1.5} /></span>
          <p className="text-fg-soft">Ningún lugar está reclamado por ahora.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Lugar</th>
                <th className="px-3 py-3 font-medium">Dueño</th>
                <th className="px-3 py-3 font-medium">Reclamado</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {places.map((p) => {
                const owner = ownerByBiz[p.business_id ?? '']
                const claim = claimByPlace[p.id]
                return (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/places/${p.id}`} className="font-medium text-fg hover:text-goospe-green">{p.name}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-goospe-green-dark"><BadgeCheck size={14} /> {owner?.display_name || 'Dueño'}</span>
                    </td>
                    <td className="px-3 py-3 text-fg-soft">{fmt(claim?.created_at ?? null)}</td>
                    <td className="px-3 py-3 text-fg-soft">{claim?.status ?? 'aprobado'}{claim?.method ? ` · ${claim.method}` : ''}</td>
                    <td className="px-4 py-3 text-right"><UnclaimButton placeId={p.id} placeName={p.name} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </div>
  )
}
