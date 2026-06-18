'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/users')
  if (!(await isAdmin(user.id))) redirect('/feed')
  return user
}

// Marca/desmarca a un usuario como admin. No te puedes quitar el admin a ti mismo
// (evita quedarte sin acceso al backoffice).
export async function setUserAdmin(formData: FormData) {
  const me = await requireAdmin()
  const userId = formData.get('user_id') as string
  const next = formData.get('next') === 'true'
  if (!userId) return { error: 'Falta el usuario' }
  if (userId === me.id && !next) return { error: 'No puedes quitarte el admin a ti mismo' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ is_admin: next } as never).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}
