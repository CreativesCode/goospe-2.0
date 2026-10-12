import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { AdminNav } from '@/features/admin/AdminNav'

// Guard único para todo /admin/*: requiere sesión + is_admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin')
  if (!(await isAdmin(user.id))) redirect('/feed')

  // Pendientes visibles en la navegación (solo el conteo; ya se validó que es admin).
  const admin = createAdminClient()
  const [claims, requests] = await Promise.all([
    admin.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('place_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  const badges = { '/admin/claims': claims.count ?? 0, '/admin/requests': requests.count ?? 0 }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:flex lg:gap-8">
        <AdminNav badges={badges} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <AppFooter />
    </main>
  )
}
