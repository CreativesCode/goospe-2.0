import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMuted } from '@/lib/notification-prefs'
import { loadMemberships } from '@/lib/account-memberships'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PageHeader } from '@/shared/components/page-header'
import { pageShell } from '@/shared/lib/ui'
import { ChangeEmailForm, ChangePasswordForm } from '@/features/profile/AccountForms'
import { DeleteAccount } from '@/features/profile/DeleteAccount'
import { NotificationPrefs } from '@/features/notifications/NotificationPrefs'
import { blockerMessage, deletionBlockers, emptyBusinessesRemoved } from '@/features/profile/account-deletion'
import { cardClass, hintClass, sectionTitle } from '@/features/business/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cuenta y seguridad | Goospe', robots: { index: false } }

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/profile/account')

  const admin = createAdminClient()
  const [{ data: profile }, muted, mine, sp] = await Promise.all([
    sb.from('profiles').select('is_admin, terms_accepted_at').eq('id', user.id).maybeSingle(),
    getMuted(user.id, admin),
    // Solo para explicar la pantalla: deleteAccount lo vuelve a calcular en el momento.
    loadMemberships(admin, user.id).then((m) => m ?? []),
    searchParams,
  ])
  const row = profile as { is_admin: boolean | null; terms_accepted_at: string | null } | null
  const blockers = deletionBlockers({ isAdmin: !!row?.is_admin, memberships: mine }).map(blockerMessage)
  const accepted = row?.terms_accepted_at
    ? new Date(row.terms_accepted_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' })
    : null

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={pageShell}>
        <div className="max-w-3xl space-y-5">
        <PageHeader back={{ href: '/profile', label: 'Mi perfil' }} title={<>Cuenta y <span className="font-medium">seguridad</span></>} />

        {sp.email === 'ok' && (
          <p role="status" className="rounded-xl bg-tint px-4 py-3 text-sm text-ink">
            Confirmamos el enlace. Tu email de acceso es {user.email}.
          </p>
        )}

        {user.email && <ChangeEmailForm currentEmail={user.email} />}
        <ChangePasswordForm />
        <NotificationPrefs muted={muted} />

        <section className={cardClass}>
          <h2 className={sectionTitle}>Términos y privacidad</h2>
          <p className={`mt-1 ${hintClass}`}>
            {accepted ? `Aceptaste los términos el ${accepted}. ` : ''}
            Puedes releer los <Link href="/terms" className="text-ink hover:underline">Términos y Condiciones</Link> y la{' '}
            <Link href="/privacy" className="text-ink hover:underline">Política de privacidad</Link> cuando quieras.
          </p>
        </section>

        <DeleteAccount blockers={blockers} emptyBusinesses={emptyBusinessesRemoved(mine).map((m) => m.businessName)} />
        </div>
      </div>
      <AppFooter />
    </main>
  )
}
