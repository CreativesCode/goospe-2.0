import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, Store, Calendar, Sparkles, ShieldCheck, Pencil, History, Bell, KeyRound, MessageSquareText, MapPin, ArrowRight, LifeBuoy, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCityChoice } from '@/lib/city-choice-server'
import { taste } from '@/shared/lib/icons'
import { appContainer, eyebrow } from '@/shared/lib/ui'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PlaceCard } from '@/features/places/PlaceCard'
import { SAVED_PLACE_SELECT, savedToCard, type SavedRow } from '@/features/places/saved-places'
import { ProfileRow } from '@/features/profile/profile-row'
import { AppearanceRow, SignOutRow } from '@/features/profile/ProfileRows'

export const metadata: Metadata = { title: 'Mi perfil | Goospe', robots: { index: false } }

export const dynamic = 'force-dynamic'

type Onboarding = { likes?: string[]; budget?: string } | null
type ProfileRecord = { display_name: string | null; avatar_url: string | null; is_admin: boolean | null; onboarding: Onboarding }

const BUDGET_LABEL = ['Económico', 'Medio', 'Alto', 'Premium']
const LIST = 'overflow-hidden rounded-[20px] border border-line bg-card'

export default async function PerfilPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/profile')

  const [{ data: profileData }, favs, revs, rsvps, unread, recent, city] = await Promise.all([
    sb.from('profiles').select('display_name, avatar_url, is_admin, onboarding').eq('id', user.id).maybeSingle(),
    sb.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
    sb.from('favorites').select(SAVED_PLACE_SELECT).order('created_at', { ascending: false }).limit(3),
    getActiveCityChoice(),
  ])
  const profile = profileData as ProfileRecord | null

  const name = profile?.display_name || user.email?.split('@')[0] || 'Tú'
  const initial = name.charAt(0).toUpperCase()
  const onboarding = (profile?.onboarding ?? null) as Onboarding
  const likes = onboarding?.likes ?? []
  const budget = onboarding?.budget ? Number(onboarding.budget) : 0
  const isAdmin = !!profile?.is_admin
  const savedCount = favs.count ?? 0
  const unreadCount = unread.count ?? 0
  // Si la consulta de recientes falla, el perfil se muestra igual (sin esa sección).
  const recentPlaces = savedToCard((recent.data ?? []) as unknown as SavedRow[])

  const STATS = [
    { label: 'Guardados', value: savedCount, href: '/saved' },
    { label: 'Reseñas', value: revs.count ?? 0, href: '/profile/activity' },
    { label: 'Eventos', value: rsvps.count ?? 0, href: '/profile/activity?tab=eventos' },
  ]

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className={`${appContainer} grid items-start gap-7 pb-14 pt-[18px] md:pt-7 lg:grid-cols-[380px_minmax(0,1fr)]`}>
        {/* identidad + gustos */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-[88px]">
          <section className="rounded-[26px] border border-line bg-card p-6">
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-goospe-gradient text-[28px] font-medium text-on-brand">
                  {initial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[22px] font-medium text-fg">{name}</h1>
                <p className="truncate text-sm">{user.email}</p>
                {city && (
                  <p className="mt-1 flex items-center gap-[5px] text-[13px] text-muted">
                    <MapPin size={13} strokeWidth={1.75} /> {city.name}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center">
              {STATS.map(({ label, value, href }, i) => (
                <Link key={label} href={href} className={`transition hover:text-ink ${i === 1 ? 'border-x border-line' : ''}`}>
                  <div className="text-[26px] font-light text-fg">{value}</div>
                  <div className="text-xs">{label}</div>
                </Link>
              ))}
            </div>
            <Link href="/profile/edit" className="mt-[18px] flex h-11 items-center justify-center gap-[7px] rounded-full border border-line text-sm font-medium text-fg transition hover:border-goospe-green/50">
              <Pencil size={15} strokeWidth={1.75} /> Editar perfil
            </Link>
          </section>

          <section className="rounded-[22px] border border-line bg-card px-[22px] py-5">
            <div className="flex items-center justify-between">
              <h2 className={eyebrow}>Tu perfil de gusto</h2>
              <Link href="/onboarding" className="text-[13px] font-medium text-ink hover:underline">Editar</Link>
            </div>
            {likes.length > 0 || budget > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
                {likes.map((slug) => {
                  const { label, icon: Icon } = taste(slug)
                  return (
                    <span key={slug} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-tint px-[11px] text-ink">
                      {Icon && <Icon size={14} strokeWidth={1.75} />} {label}
                    </span>
                  )
                })}
                {budget > 0 && (
                  <span className="inline-flex h-8 items-center rounded-full border border-line px-[11px] text-fg">
                    {BUDGET_LABEL[budget - 1] ?? '$'.repeat(budget)}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm">Cuéntanos qué te gusta y el feed te sugerirá mejor.</p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <section>
              <h2 className={`${eyebrow} px-1 pb-2.5`}>Tu actividad</h2>
              <div className={LIST}>
                <ProfileRow href="/profile/activity" icon={History} label="Mi actividad" />
                <ProfileRow href="/saved" icon={Heart} label="Mis guardados" hint={savedCount ? String(savedCount) : undefined} />
                <ProfileRow href="/notifications" icon={Bell} label="Notificaciones" hint={unreadCount ? `${unreadCount} ${unreadCount === 1 ? 'nueva' : 'nuevas'}` : undefined} />
                <ProfileRow href="/events" icon={Calendar} label="Eventos" />
              </div>
            </section>
            <section>
              <h2 className={`${eyebrow} px-1 pb-2.5`}>Ajustes</h2>
              <div className={LIST}>
                <ProfileRow href="/onboarding" icon={Sparkles} label="Mis gustos" />
                <ProfileRow href="/profile/account" icon={KeyRound} label="Cuenta y seguridad" />
                <AppearanceRow />
                <ProfileRow href="/feedback" icon={MessageSquareText} label="Enviar comentarios" />
                <ProfileRow href="/help" icon={LifeBuoy} label="Ayuda" />
                {isAdmin && <ProfileRow href="/admin" icon={LayoutDashboard} label="Panel de administración" />}
                {isAdmin && <ProfileRow href="/admin/content" icon={ShieldCheck} label="Moderar contenido" />}
                <SignOutRow />
              </div>
            </section>
          </div>

          {recentPlaces.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between px-1 pb-2.5">
                <h2 className={eyebrow}>Guardados recientes</h2>
                <Link href="/saved" className="text-[13px] font-medium text-ink hover:underline">Ver todos</Link>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))]">
                {recentPlaces.map((p) => <PlaceCard key={p.id} place={p} imgClassName="h-[120px]" saved />)}
              </div>
            </section>
          )}

          {/* gancho B2B */}
          <section className="flex flex-wrap items-center gap-4 rounded-[22px] bg-deep px-6 py-[22px] text-deep-soft">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-[rgba(45,193,134,0.16)] text-goospe-green-light">
              <Store size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-[200px] flex-1">
              <p className="text-[17px] font-medium text-[#F3EFE8]">¿Tienes un negocio?</p>
              <p className="text-sm">Reclama tu ficha y destácate en el feed. Gratis durante el piloto.</p>
            </div>
            <Link href="/panel" className="inline-flex h-11 items-center gap-[7px] rounded-full bg-goospe-green px-5 text-sm font-medium text-on-brand transition hover:brightness-105">
              Ir al panel <ArrowRight size={15} strokeWidth={1.75} />
            </Link>
          </section>
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
