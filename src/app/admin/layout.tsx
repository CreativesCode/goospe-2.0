import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { AdminNav } from '@/features/admin/AdminNav'
import { appContainer } from '@/shared/lib/ui'

// Título de cada sección del backoffice: "<Sección> · Admin | Goospe" (antes todas las
// pestañas decían lo mismo que la portada). Nada del backoffice se indexa.
export const metadata: Metadata = {
  title: { default: 'Admin | Goospe', template: '%s · Admin | Goospe' },
  robots: { index: false, follow: false },
}

// Guard único para todo /admin/*: requiere sesión + is_admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin')
  if (!(await isAdmin(user.id))) redirect('/feed')

  // Pendientes visibles en la navegación (solo el conteo; ya se validó que es admin).
  const admin = createAdminClient()
  const [claims, requests, proposals, feedback] = await Promise.all([
    admin.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('place_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Sin la migración 0039 la tabla no existe: count viene nulo y cuenta como 0.
    admin.from('place_proposals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Sin la migración 0042 la tabla no existe: count viene nulo y cuenta como 0.
    admin.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])
  const badges = { '/admin/claims': claims.count ?? 0, '/admin/requests': (requests.count ?? 0) + (proposals.count ?? 0), '/admin/feedback': feedback.count ?? 0 }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={`${appContainer} grid flex-1 items-start gap-6 pb-14 pt-5 md:pt-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8`}>
        <AdminNav badges={badges} />
        <div className="min-w-0">{children}</div>
      </div>
      <AppFooter />
    </main>
  )
}
