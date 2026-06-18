'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

const MAX_BYTES = 5 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Subida de foto por un usuario. place_photos no tiene policy de INSERT para authenticated,
// así que pasa por admin client, pero fijando author_id = sesión real y status='pending'
// (queda en cola de moderación; sólo se muestra públicamente al aprobarse).
export async function uploadPlacePhoto(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const file = formData.get('file') as File | null

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para subir fotos' }
  if (!file || file.size === 0) return { error: 'Selecciona una imagen' }
  if (!OK_TYPES.includes(file.type)) return { error: 'Formato no soportado (usa JPG, PNG o WebP)' }
  if (file.size > MAX_BYTES) return { error: 'La imagen supera los 5 MB' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `user/${placeId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  const { error: upErr } = await admin.storage.from('places').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const { data: pub } = admin.storage.from('places').getPublicUrl(path)
  const { error: insErr } = await admin.from('place_photos').insert({
    place_id: placeId,
    url: pub.publicUrl,
    author_id: user.id,
    status: 'pending',
    source: 'user',
    storage_path: path,
  } as never)
  if (insErr) {
    await admin.storage.from('places').remove([path]) // rollback del objeto huérfano
    return { error: insErr.message }
  }

  return { success: true }
}

// Moderación (sólo admin): aprobar o rechazar. Rechazar borra la fila y el objeto del bucket.
export async function moderatePhoto(formData: FormData) {
  const photoId = formData.get('photo_id') as string
  const decision = formData.get('decision') as string // 'approve' | 'reject'

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return { error: 'No autorizado' }

  const admin = createAdminClient()
  if (decision === 'approve') {
    const { error } = await admin.from('place_photos').update({ status: 'approved' } as never).eq('id', photoId)
    if (error) return { error: error.message }
  } else {
    const { data: ph } = await admin.from('place_photos').select('storage_path').eq('id', photoId).maybeSingle()
    const path = (ph as { storage_path: string | null } | null)?.storage_path
    await admin.from('place_photos').delete().eq('id', photoId)
    if (path) await admin.storage.from('places').remove([path])
  }

  revalidatePath('/admin/photos')
  return { success: true }
}
