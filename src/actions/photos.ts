'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validation'

const MAX_BYTES = 5 * 1024 * 1024
const UPLOADS_PER_HOUR = 10
const UPLOAD_FAILED = 'No pudimos subir la foto. Intenta de nuevo.'
const BAD_FORMAT = 'Formato no soportado (usa JPG, PNG o WebP)'

type ImageKind = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

// Tipo REAL del archivo por sus magic bytes (el `file.type` lo declara el cliente y no es fiable).
function sniffImage(b: Buffer): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

// Subida de foto por un usuario. place_photos no tiene policy de INSERT para authenticated,
// así que pasa por admin client, pero fijando author_id = sesión real y status='pending'
// (queda en cola de moderación; sólo se muestra públicamente al aprobarse).
export async function uploadPlacePhoto(formData: FormData) {
  const placeId = formData.get('place_id')
  const fileEntry = formData.get('file')
  const file = fileEntry instanceof File ? fileEntry : null

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Inicia sesión para subir fotos' }
  // place_id va a la ruta del bucket: debe ser un uuid (evita path traversal) de un lugar real.
  if (!isUuid(placeId)) return { error: 'Lugar inválido' }
  if (!file || file.size === 0) return { error: 'Selecciona una imagen' }
  if (file.size > MAX_BYTES) return { error: 'La imagen supera los 5 MB' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(buffer)
  if (!kind) return { error: BAD_FORMAT }

  const admin = createAdminClient()
  const { data: place } = await admin.from('places').select('id').eq('id', placeId).maybeSingle()
  if (!place) return { error: 'Lugar no encontrado' }

  if (!(await rateLimit(`photo-upload:${user.id}`, 3600, UPLOADS_PER_HOUR))) {
    return { error: 'Subiste muchas fotos seguidas. Intenta de nuevo en un rato.' }
  }

  // Extensión y content-type derivados del tipo detectado, nunca del nombre o mime del cliente.
  const path = `user/${placeId}/${randomUUID()}.${kind.ext}`
  const { error: upErr } = await admin.storage.from('places').upload(path, buffer, {
    contentType: kind.mime,
    upsert: false,
  })
  if (upErr) {
    // Nunca devolver el mensaje de Storage / Postgres al cliente.
    console.error('[uploadPlacePhoto] storage:', upErr.message)
    return { error: UPLOAD_FAILED }
  }

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
    console.error('[uploadPlacePhoto] insert:', insErr.message)
    return { error: UPLOAD_FAILED }
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
    if (error) {
      console.error('[moderatePhoto]', error.message)
      return { error: 'No pudimos guardar. Intenta de nuevo.' }
    }
  } else {
    const { data: ph } = await admin.from('place_photos').select('storage_path').eq('id', photoId).maybeSingle()
    const path = (ph as { storage_path: string | null } | null)?.storage_path
    await admin.from('place_photos').delete().eq('id', photoId)
    if (path) await admin.storage.from('places').remove([path])
  }

  revalidatePath('/admin/photos')
  return { success: true }
}
