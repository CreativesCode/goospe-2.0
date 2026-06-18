'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

// Todas las escrituras del backoffice pasan por aquí: validan sesión + is_admin
// y luego usan el admin client / RPC SECURITY DEFINER. No relaja RLS de ninguna tabla.
async function requireAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/places')
  if (!(await isAdmin(user.id))) redirect('/feed')
  return user
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 60)

const toArray = (s: string) =>
  s.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12)

const num = (v: FormDataEntryValue | null) => {
  const n = Number(v)
  return v != null && v !== '' && Number.isFinite(n) ? n : null
}

// Garantiza un slug único (sufijo -2, -3… si choca). Excluye el propio place al editar.
async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string, selfId: string | null) {
  let slug = base || 'lugar'
  for (let i = 0; i < 50; i++) {
    const { data } = await admin.from('places').select('id').eq('slug', slug).maybeSingle()
    const hit = data as { id: string } | null
    if (!hit || hit.id === selfId) return slug
    slug = `${base}-${i + 2}`
  }
  return `${base}-${Date.now()}`
}

export async function saveAdminPlace(formData: FormData) {
  await requireAdmin()
  const admin = createAdminClient()

  const id = (formData.get('id') as string) || null
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'El nombre es obligatorio' }

  const slugInput = (formData.get('slug') as string)?.trim()
  const slug = await uniqueSlug(admin, slugify(slugInput || name), id)

  const price = num(formData.get('price_level'))
  const categoryIds = formData.getAll('category_ids').map((v) => Number(v)).filter(Number.isFinite)

  const { data, error } = await admin.rpc('admin_save_place', {
    p_id: id,
    p_name: name,
    p_slug: slug,
    p_description: (formData.get('description') as string)?.trim() || null,
    p_vibe_line: (formData.get('vibe_line') as string)?.trim() || null,
    p_phone: (formData.get('phone') as string)?.trim() || null,
    p_whatsapp: (formData.get('whatsapp') as string)?.trim() || null,
    p_website: (formData.get('website') as string)?.trim() || null,
    p_instagram: (formData.get('instagram') as string)?.trim() || null,
    p_email: (formData.get('email') as string)?.trim() || null,
    p_price_level: price && price >= 1 && price <= 4 ? price : null,
    p_tags: toArray((formData.get('tags') as string) ?? ''),
    p_lat: num(formData.get('lat')),
    p_lng: num(formData.get('lng')),
    p_is_published: formData.get('is_published') === 'on',
    p_category_ids: categoryIds,
  } as never)

  if (error) return { error: error.message }

  const newId = data as unknown as string
  revalidatePath('/admin/places')
  revalidatePath(`/admin/places/${newId}`)
  revalidatePath(`/places/${slug}`)
  return { success: true, id: newId, slug }
}

// Publicar / ocultar rápido desde la lista. Sin geografía → admin client directo.
export async function setPublished(formData: FormData) {
  await requireAdmin()
  const id = formData.get('id') as string
  const next = formData.get('next') === 'true'
  const admin = createAdminClient()
  const { error } = await admin.from('places').update({ is_published: next, updated_at: new Date().toISOString() } as never).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/places')
  return { success: true }
}
