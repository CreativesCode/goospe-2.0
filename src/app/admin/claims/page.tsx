import Link from 'next/link'
import { BadgeCheck, Store } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { UnclaimButton } from '@/features/admin/UnclaimButton'

export const dynamic = 'force-dynamic'

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

type PlaceRow = { id: string; name: string; slug: string; business_id: string | null; is_published: boolean | null }

export default async function AdminClaimsPage() {
  const admin = createAdminClient()
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-fg">Reclamos</h1>
        <p className="text-sm text-fg-soft">{places.length} {places.length === 1 ? 'lugar reclamado' : 'lugares reclamados'} · dueño y acción para liberar.</p>
      </header>

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
    </div>
  )
}
