import { redirect } from 'next/navigation'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlaceProposalForm, type ProposalCity } from '@/features/business/PlaceProposalForm'
import { loadCategories } from '@/features/business/panel-data'
import { cardClass } from '@/features/business/ui'
import { ClaimSteps } from '@/features/business/ClaimSteps'
import { PageHeader } from '@/shared/components/page-header'
import { pageShell } from '@/shared/lib/ui'
import { PROPOSAL_NAME_MAX } from '@/features/business/place-proposal-schema'

export const dynamic = 'force-dynamic'

// "Proponer un lugar nuevo": para quien no encuentra su negocio al reclamarlo. Basta con tener
// sesión; la propuesta la revisa un admin (ver /admin/requests).
export default async function ProposePlacePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel/propose')

  const sp = await searchParams
  const defaultName = (typeof sp.name === 'string' ? sp.name : '').trim().slice(0, PROPOSAL_NAME_MAX)

  // Catálogos públicos (categorías y ciudades activas): se leen ya con la sesión validada.
  const admin = createAdminClient()
  const [categories, { data: cityRows }] = await Promise.all([
    loadCategories(admin),
    admin.from('cities').select('id, name, country').eq('is_active', true).order('country').order('name'),
  ])
  const cities = (cityRows ?? []) as ProposalCity[]

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className={pageShell}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          <div className="min-w-0">
            <PageHeader back={{ href: '/panel/claim', label: 'Reclamar un lugar' }} kicker="Para tu negocio" title={<>Proponer un <span className="font-medium">lugar nuevo</span></>} subtitle="¿Tu negocio todavía no está en Goospe? Cuéntanos dónde queda y lo sumamos." />

            <section className={cardClass}>
              <PlaceProposalForm categories={categories} cities={cities} defaultName={defaultName} />
            </section>
          </div>

          <ClaimSteps variant="propose" />
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
