'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validation'
import { revalidatePlace } from '@/lib/revalidate-place'
import { BAD_IMAGE_FORMAT as BAD_FORMAT, IMAGE_MAX_BYTES as MAX_BYTES, sniffImage } from '@/lib/image-sniff'

const UPLOADS_PER_HOUR = 10
const UPLOAD_FAILED = 'No pudimos subir la foto. Intenta de nuevo.'

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
  })
  if (insErr) {
    await admin.storage.from('places').remove([path]) // rollback del objeto huérfano
    console.error('[uploadPlacePhoto] insert:', insErr.message)
    return { error: UPLOAD_FAILED }
  }

  return { success: true }
}

// Moderación (sólo admin): aprobar o rechazar. Rechazar borra la fila y el objeto del bucket.
export async function moderatePhoto(formData: FormData) {
  const photoId = formData.get('photo_id')
  const decision = formData.get('decision') // 'approve' | 'reject'
  if (!isUuid(photoId) || (decision !== 'approve' && decision !== 'reject')) return { error: 'Solicitud inválida' }

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return { error: 'No autorizado' }

  const admin = createAdminClient()
  const { data: row } = await admin.from('place_photos').select('place_id').eq('id', photoId).maybeSingle()
  const placeId = (row as { place_id: string } | null)?.place_id ?? null
  if (decision === 'approve') {
    const { error } = await admin.from('place_photos').update({ status: 'approved' }).eq('id', photoId)
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
  // Una foto recién aprobada debe verse ya en la ficha pública (ISR de 1 h).
  if (placeId && decision === 'approve') await revalidatePlace(placeId)
  return { success: true }
}
