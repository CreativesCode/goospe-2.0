import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UpdatePasswordForm } from '@/features/auth/components'

export const dynamic = 'force-dynamic'

// Solo con sesión: se llega aquí desde /auth/callback tras abrir el enlace de recuperación.
// Sin sesión (enlace vencido, o URL abierta a mano) el formulario fallaría al enviar; mejor
// mandar a pedir un enlace nuevo.
export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=expired')

  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-fg">Nueva contraseña</h1>
      <p className="mb-6 mt-1 text-center text-fg-soft">Define tu nueva contraseña</p>
      <UpdatePasswordForm />
    </div>
  )
}
