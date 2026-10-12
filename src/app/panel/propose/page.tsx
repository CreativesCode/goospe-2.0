import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlaceProposalForm, type ProposalCity } from '@/features/business/PlaceProposalForm'
import { loadCategories } from '@/features/business/panel-data'
import { cardClass } from '@/features/business/ui'
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

      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-5 sm:py-8">
        <Link href="/panel/claim" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-soft transition hover:text-goospe-green">
          <ArrowLeft size={16} strokeWidth={1.75} /> Reclamar un lugar
        </Link>
        <h1 className="text-2xl font-medium text-fg">Proponer un lugar nuevo</h1>
        <p className="mt-1 text-fg-soft">¿Tu negocio todavía no está en Goospe? Cuéntanos dónde queda y lo sumamos.</p>

        <section className={`mt-6 ${cardClass}`}>
          <PlaceProposalForm categories={categories} cities={cities} defaultName={defaultName} />
        </section>
      </div>

      <AppFooter />
    </main>
  )
}
