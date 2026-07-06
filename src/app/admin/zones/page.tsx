import { MapPin, Globe } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { CoverageZonesTable, type CoverageZone } from '@/features/coverage/components/CoverageZonesTable'

export const dynamic = 'force-dynamic'

export default async function CoverageZonesPage() {
  const admin = createAdminClient()
  // RPC nueva (0030) aún no está en database.types.ts → helper sin tipado estricto (igual que /admin).
  const arpc = admin.rpc.bind(admin) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown }>

  const { data } = await arpc('admin_coverage_zones', { p_days: 180, p_limit: 100 })
  const zones = ((data ?? []) as CoverageZone[]).map((z) => ({
    ...z,
    lat: Number(z.lat),
    lng: Number(z.lng),
    hits: Number(z.hits),
  }))
  const totalHits = zones.reduce((s, z) => s + z.hits, 0)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Zonas sin cobertura</h1>
        <p className="text-sm text-fg-soft">
          Desde dónde abren Goospe personas que aún no están en una ciudad activa. Úsalo para decidir
          qué zona cargar. Agrupado por celdas de ~11 km · últimos 180 días.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <Globe size={18} strokeWidth={1.75} className="text-goospe-green" />
          <div className="mt-2 text-2xl font-semibold text-fg">{zones.length}</div>
          <div className="text-xs font-medium text-fg-soft">Zonas distintas</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <MapPin size={18} strokeWidth={1.75} className="text-goospe-green" />
          <div className="mt-2 text-2xl font-semibold text-fg">{totalHits}</div>
          <div className="text-xs font-medium text-fg-soft">Aperturas fuera de cobertura</div>
        </div>
      </section>

      {zones.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center text-sm text-muted">
          Aún no hay aperturas registradas fuera de cobertura. Aquí aparecerán las zonas desde donde
          abran la app usuarios que todavía no cubrimos.
        </div>
      ) : (
        <CoverageZonesTable zones={zones} />
      )}
    </div>
  )
}
