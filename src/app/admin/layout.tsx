import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:flex lg:gap-8">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <AppFooter />
    </main>
  )
}
