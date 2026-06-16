'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  redirect((formData.get('next') as string) || '/feed')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const displayName = (formData.get('display_name') as string) || null
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: { data: { full_name: displayName } }, // lo lee handle_new_user → profiles.display_name
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  // Si la confirmación de email está desactivada, ya hay sesión → al feed; si no, a check-email.
  if (data.session) redirect('/feed')
  redirect('/check-email')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/feed')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(formData.get('email') as string, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: formData.get('password') as string })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  redirect('/feed')
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  // `as never`: workaround del tipado de mutaciones de supabase-js (infiere el payload como never).
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: formData.get('display_name') as string } as never)
    .eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}
