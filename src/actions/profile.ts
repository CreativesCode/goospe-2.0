'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { BAD_IMAGE_FORMAT, IMAGE_MAX_BYTES, sniffImage } from '@/lib/image-sniff'
import { storagePathFromUrl } from '@/lib/storage-path'
import { firstIssue, profileSchema } from '@/features/profile/profile-schema'

// Perfil editable. Las columnas se escriben con el CLIENTE DEL USUARIO: la RLS "update own
// profile" y los grants por columna de 0033 (display_name, avatar_url, home_city_id,
// birth_year) son los que mandan; desde aquí no se puede tocar is_admin, onboarding ni la
// aceptación de términos. Solo el archivo del avatar pasa por service role (el bucket no tiene
// políticas de escritura para usuarios), siempre dentro de la carpeta del propio usuario.
const SAVE_FAILED = 'No pudimos guardar tu perfil. Intenta de nuevo.'
const UPLOAD_FAILED = 'No pudimos subir tu foto. Intenta de nuevo.'
const BUCKET = 'places'
const avatarDir = (userId: string) => `avatars/${userId}/`

async function sessionUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return { sb, user }
}

function refresh() {
  revalidatePath('/profile')
  revalidatePath('/profile/edit')
}

export async function updateProfile(formData: FormData) {
  const { sb, user } = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const parsed = profileSchema().safeParse({
    display_name: formData.get('display_name'),
    home_city_id: formData.get('home_city_id'),
    birth_year: formData.get('birth_year'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!(await rateLimit(`profile-update:${user.id}`, 3600, 30))) return { error: 'Demasiados cambios seguidos. Intenta de nuevo en un rato.' }

  // La ciudad debe ser una ciudad ACTIVA: el formulario solo ofrece esas, pero el id llega del
  // navegador y la FK aceptaría cualquier ciudad existente (también una desactivada). Se
  // tolera la que el perfil ya tenía guardada, para que una ciudad que se desactivó después no
  // impida cambiar el nombre o el año.
  const cityId = parsed.data.home_city_id
  if (cityId !== null) {
    const [{ data: city, error: cityErr }, { data: current }] = await Promise.all([
      sb.from('cities').select('id, is_active').eq('id', cityId).maybeSingle(),
      sb.from('profiles').select('home_city_id').eq('id', user.id).maybeSingle(),
    ])
    if (cityErr) {
      console.error('[updateProfile] ciudad:', cityErr.message)
      return { error: SAVE_FAILED }
    }
    const unchanged = (current as { home_city_id: number | null } | null)?.home_city_id === cityId
    if (!city || ((city as { is_active: boolean | null }).is_active !== true && !unchanged)) {
      return { error: 'Esa ciudad ya no está disponible' }
    }
  }

  // `as never`: workaround del tipado del cliente con cookies (igual que en toggleRsvp).
  const { error } = await sb.from('profiles').update(parsed.data as never).eq('id', user.id)
  if (error) {
    // 23503: la ciudad elegida no existe.
    console.error('[updateProfile]', error.message)
    return { error: error.code === '23503' ? 'Esa ciudad ya no está disponible' : SAVE_FAILED }
  }
  refresh()
  return { success: true }
}

// Borra el archivo anterior solo si vive en la carpeta de avatares de ESTE usuario.
async function removeOldAvatar(userId: string, url: string | null) {
  const path = storagePathFromUrl(url, BUCKET, avatarDir(userId))
  if (!path) return
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path])
  if (error) console.error('[avatar] borrar anterior:', error.message)
}

export async function uploadAvatar(formData: FormData) {
  const { sb, user } = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const entry = formData.get('file')
  const file = entry instanceof File ? entry : null
  if (!file || file.size === 0) return { error: 'Selecciona una imagen' }
  if (file.size > IMAGE_MAX_BYTES) return { error: 'La imagen supera los 5 MB' }
  // El tipo sale de los magic bytes, nunca del nombre o del mime que declara el navegador.
  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(buffer)
  if (!kind) return { error: BAD_IMAGE_FORMAT }
  if (!(await rateLimit(`avatar-upload:${user.id}`, 3600, 10))) return { error: 'Cambiaste tu foto muchas veces seguidas. Intenta de nuevo en un rato.' }

  const { data: prev } = await sb.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  const admin = createAdminClient()
  const path = `${avatarDir(user.id)}${randomUUID()}.${kind.ext}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: kind.mime, upsert: false })
  if (upErr) {
    console.error('[uploadAvatar] storage:', upErr.message)
    return { error: UPLOAD_FAILED }
  }
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const { error } = await sb.from('profiles').update({ avatar_url: url } as never).eq('id', user.id)
  if (error) {
    await admin.storage.from(BUCKET).remove([path]) // rollback del objeto huérfano
    console.error('[uploadAvatar] profiles:', error.message)
    return { error: UPLOAD_FAILED }
  }
  await removeOldAvatar(user.id, (prev as { avatar_url: string | null } | null)?.avatar_url ?? null)
  refresh()
  return { success: true, url }
}

export async function removeAvatar() {
  const { sb, user } = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const { data: prev } = await sb.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  const { error } = await sb.from('profiles').update({ avatar_url: null } as never).eq('id', user.id)
  if (error) {
    console.error('[removeAvatar]', error.message)
    return { error: SAVE_FAILED }
  }
  await removeOldAvatar(user.id, (prev as { avatar_url: string | null } | null)?.avatar_url ?? null)
  refresh()
  return { success: true }
}
