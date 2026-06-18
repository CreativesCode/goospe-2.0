import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, Star, Ticket, Store, Calendar, Sparkles, ShieldCheck, ChevronRight, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { taste } from '@/shared/lib/icons'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'

export const dynamic = 'force-dynamic'

type Onboarding = { likes?: string[]; budget?: string } | null
type ProfileRow = { display_name: string | null; avatar_url: string | null; is_admin: boolean | null; onboarding: Onboarding }

export default async function PerfilPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/perfil')

  const [{ data: profileData }, favs, revs, rsvps] = await Promise.all([
    sb.from('profiles').select('display_name, avatar_url, is_admin, onboarding').eq('id', user.id).maybeSingle(),
    sb.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])
  const profile = profileData as ProfileRow | null

  const name = profile?.display_name || user.email?.split('@')[0] || 'Tú'
  const initial = name.charAt(0).toUpperCase()
  const onboarding = (profile?.onboarding ?? null) as Onboarding
  const likes = onboarding?.likes ?? []
  const budget = onboarding?.budget ? Number(onboarding.budget) : 0
  const isAdmin = !!profile?.is_admin

  const STATS: { label: string; value: number; icon: LucideIcon; href: string }[] = [
    { label: 'Guardados', value: favs.count ?? 0, icon: Heart, href: '/saved' },
    { label: 'Reseñas', value: revs.count ?? 0, icon: Star, href: '/feed' },
    { label: 'Eventos', value: rsvps.count ?? 0, icon: Ticket, href: '/eventos' },
  ]

  const LINKS: { label: string; href: string; icon: LucideIcon }[] = [
    { label: 'Mis guardados', href: '/saved', icon: Heart },
    { label: 'Eventos', href: '/eventos', icon: Calendar },
    { label: 'Mis gustos', href: '/onboarding', icon: Sparkles },
    ...(isAdmin ? [{ label: 'Moderar contenido', href: '/admin/content', icon: ShieldCheck as LucideIcon }] : []),
  ]

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-2xl px-5 py-8">
        {/* identidad */}
        <section className="flex items-center gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-line" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-goospe-gradient text-3xl font-medium text-white ring-2 ring-white/30">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-medium text-fg">{name}</h1>
            <p className="truncate text-sm text-fg-soft">{user.email}</p>
          </div>
        </section>

        {/* stats */}
        <section className="mt-7 grid grid-cols-3 gap-3">
          {STATS.map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={href} className="rounded-2xl border border-line bg-card p-4 text-center transition hover:border-goospe-green/40">
              <Icon size={20} strokeWidth={1.75} className="mx-auto text-goospe-green" />
              <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
              <div className="text-xs text-fg-soft">{label}</div>
            </Link>
          ))}
        </section>

        {/* perfil de gusto */}
        {(likes.length > 0 || budget > 0) && (
          <section className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Tu perfil de gusto</h2>
              <Link href="/onboarding" className="text-xs font-medium text-goospe-green hover:underline">Editar</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {likes.map((slug) => {
                const { label, icon: Icon } = taste(slug)
                return (
                  <span key={slug} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-fg-soft">
                    {Icon && <Icon size={15} strokeWidth={1.75} className="text-goospe-green" />} {label}
                  </span>
                )
              })}
              {budget > 0 && (
                <span className="inline-flex items-center rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium text-fg-soft">
                  {'$'.repeat(budget)}
                </span>
              )}
            </div>
          </section>
        )}

        {/* menú */}
        <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-card">
          {LINKS.map(({ label, href, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3.5 text-sm text-fg transition hover:bg-goospe-green/10 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <Icon size={18} strokeWidth={1.75} className="text-fg-soft" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={16} strokeWidth={1.75} className="text-muted" />
            </Link>
          ))}
        </section>

        {/* gancho B2B */}
        <section className="mt-7 flex items-center gap-4 rounded-2xl border border-goospe-green/20 bg-goospe-green/[0.05] p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-goospe-green/15 text-goospe-green-dark">
            <Store size={22} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">¿Tienes un negocio?</p>
            <p className="text-sm text-fg-soft">Reclama tu ficha y destácate en el feed.</p>
          </div>
          <Link href="/panel" className="shrink-0 rounded-full bg-goospe-gradient px-4 py-2 text-sm font-medium text-white shadow">
            Panel
          </Link>
        </section>

      </div>

      <AppFooter />
    </main>
  )
}
