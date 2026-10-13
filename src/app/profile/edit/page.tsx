import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { ProfileForm, type CityOption } from '@/features/profile/ProfileForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Editar perfil | Goospe', robots: { index: false } }

type ProfileRow = { display_name: string | null; avatar_url: string | null; home_city_id: number | null; birth_year: number | null }

export default async function EditProfilePage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/profile/edit')

  const [{ data: profileData }, { data: cityData }] = await Promise.all([
    sb.from('profiles').select('display_name, avatar_url, home_city_id, birth_year').eq('id', user.id).maybeSingle(),
    sb.from('cities').select('id, name, region').eq('is_active', true).order('name'),
  ])
  const profile = profileData as ProfileRow | null
  const cities = (cityData ?? []) as CityOption[]

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <Link href="/profile" className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-soft hover:text-fg"><ChevronLeft size={16} /> Mi perfil</Link>
        <h1 className="mb-5 mt-1 text-2xl font-medium text-fg">Editar perfil</h1>

        <ProfileForm
          cities={cities}
          initial={{
            displayName: profile?.display_name ?? '',
            avatarUrl: profile?.avatar_url ?? null,
            homeCityId: profile?.home_city_id ?? null,
            birthYear: profile?.birth_year ?? null,
          }}
        />

        {/* Rehacer el onboarding de gustos: misma pantalla y misma acción que al registrarse. */}
        <Link href="/onboarding" className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-goospe-green/40 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-goospe-green/10 text-goospe-green"><Sparkles size={20} strokeWidth={1.75} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-fg">Mis gustos</span>
            <span className="block text-sm text-fg-soft">Vuelve a elegir qué te gusta y tu presupuesto: tu feed se ajusta al guardar.</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
        </Link>

        <p className="mt-5 text-sm text-fg-soft">
          ¿Buscas cambiar tu email o tu contraseña? Está en <Link href="/profile/account" className="font-medium text-goospe-green hover:underline">Cuenta y seguridad</Link>.
        </p>
      </div>
      <AppFooter />
    </main>
  )
}
