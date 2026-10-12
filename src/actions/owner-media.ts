'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/owner-guard'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePlace } from '@/lib/revalidate-place'
import { audit } from '@/lib/audit'
import { BAD_IMAGE_FORMAT, IMAGE_MAX_BYTES, sniffImage } from '@/lib/image-sniff'
import { storagePathFromUrl } from '@/lib/storage-path'
import { isUuid } from '@/lib/validation'

// Imágenes del negocio: portada, logo y fotos propias. Todo pasa por aquí con service role
// DESPUÉS de validar sesión y membresía; el bucket `places` no acepta subidas del navegador.
const BUCKET = 'places'
const UPLOADS_PER_HOUR = 30
const MAX_OWNER_PHOTOS = 20
const UPLOAD_FAILED = 'No pudimos subir la imagen. Intenta de nuevo.'
const TOO_FAST = 'Subiste muchas imágenes seguidas. Intenta de nuevo en un rato.'

type AdminClient = ReturnType<typeof createAdminClient>
type Slot = 'cover' | 'logo'
const COLUMN: Record<Slot, 'cover_url' | 'logo_url'> = { cover: 'cover_url', logo: 'logo_url' }
const isSlot = (v: unknown): v is Slot => v === 'cover' || v === 'logo'

// Valida tamaño y tipo REAL (magic bytes) y sube al bucket. Devuelve ruta y URL pública.
async function storeImage(admin: AdminClient, entry: FormDataEntryValue | null, placeId: string, name: string) {
  const file = entry instanceof File ? entry : null
  if (!file || file.size === 0) return { error: 'Selecciona una imagen' }
  if (file.size > IMAGE_MAX_BYTES) return { error: 'La imagen supera los 5 MB' }
  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(buffer)
  if (!kind) return { error: BAD_IMAGE_FORMAT }

  // placeId ya es un uuid validado: no hay forma de salir de la carpeta del lugar.
  const path = `owner/${placeId}/${name}-${randomUUID()}.${kind.ext}`
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: kind.mime, upsert: false })
  if (error) {
    console.error('[owner-media] storage:', error.message)
    return { error: UPLOAD_FAILED }
  }
  return { path, url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

function refresh(placeId: string) {
  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/panel')
  return revalidatePlace(placeId)
}

/** Sube (o reemplaza) la portada o el logo del lugar. */
export async function uploadPlaceImage(formData: FormData) {
  const slot = formData.get('slot')
  if (!isSlot(slot)) return { error: 'Solicitud inválida' }
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }
  if (!(await rateLimit(`owner-media:${ctx.user.id}`, 3600, UPLOADS_PER_HOUR))) return { error: TOO_FAST }

  const admin = createAdminClient()
  const column = COLUMN[slot]
  const { data: row } = await admin.from('places').select('cover_url, logo_url').eq('id', ctx.placeId).maybeSingle()
  const previous = (row as { cover_url: string | null; logo_url: string | null } | null)?.[column] ?? null

  const stored = await storeImage(admin, formData.get('file'), ctx.placeId, slot)
  if ('error' in stored) return { error: stored.error }

  const patch = slot === 'cover' ? { cover_url: stored.url } : { logo_url: stored.url }
  const { error } = await admin.from('places').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', ctx.placeId)
  if (error) {
    await admin.storage.from(BUCKET).remove([stored.path]) // no dejar el objeto huérfano
    console.error('[uploadPlaceImage]', error.message)
    return { error: UPLOAD_FAILED }
  }

  // El archivo anterior solo se borra si era del propio lugar (carpeta owner/{placeId}/).
  const oldPath = storagePathFromUrl(previous, BUCKET, `owner/${ctx.placeId}/`)
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath])

  await audit({ userId: ctx.user.id, action: `owner.${slot}_update`, objectType: 'place', objectId: ctx.placeId, payload: { before: previous, after: stored.url } })
  await refresh(ctx.placeId)
  return { success: true, url: stored.url }
}

/** Quita la portada o el logo (la ficha vuelve a la primera foto aprobada). */
export async function removePlaceImage(formData: FormData) {
  const slot = formData.get('slot')
  if (!isSlot(slot)) return { error: 'Solicitud inválida' }
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const admin = createAdminClient()
  const column = COLUMN[slot]
  const { data: row } = await admin.from('places').select('cover_url, logo_url').eq('id', ctx.placeId).maybeSingle()
  const previous = (row as { cover_url: string | null; logo_url: string | null } | null)?.[column] ?? null
  if (!previous) return { success: true }

  const patch = slot === 'cover' ? { cover_url: null } : { logo_url: null }
  const { error } = await admin.from('places').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', ctx.placeId)
  if (error) {
    console.error('[removePlaceImage]', error.message)
    return { error: 'No pudimos quitar la imagen. Intenta de nuevo.' }
  }
  const oldPath = storagePathFromUrl(previous, BUCKET, `owner/${ctx.placeId}/`)
  if (oldPath) await admin.storage.from(BUCKET).remove([oldPath])

  await audit({ userId: ctx.user.id, action: `owner.${slot}_remove`, objectType: 'place', objectId: ctx.placeId, payload: { before: previous } })
  await refresh(ctx.placeId)
  return { success: true }
}

/** Foto propia del negocio: la sube un dueño verificado, así que queda aprobada directamente. */
export async function uploadOwnerPhoto(formData: FormData) {
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }
  if (!(await rateLimit(`owner-media:${ctx.user.id}`, 3600, UPLOADS_PER_HOUR))) return { error: TOO_FAST }

  const admin = createAdminClient()
  const { count } = await admin.from('place_photos')
    .select('id', { count: 'exact', head: true }).eq('place_id', ctx.placeId).eq('source', 'owner')
  if ((count ?? 0) >= MAX_OWNER_PHOTOS) return { error: `Puedes tener hasta ${MAX_OWNER_PHOTOS} fotos propias. Elimina alguna para subir otra.` }

  const stored = await storeImage(admin, formData.get('file'), ctx.placeId, 'photo')
  if ('error' in stored) return { error: stored.error }

  const { error } = await admin.from('place_photos').insert({
    place_id: ctx.placeId, url: stored.url, author_id: ctx.user.id,
    status: 'approved', source: 'owner', storage_path: stored.path,
  })
  if (error) {
    await admin.storage.from(BUCKET).remove([stored.path])
    console.error('[uploadOwnerPhoto]', error.message)
    return { error: UPLOAD_FAILED }
  }

  await audit({ userId: ctx.user.id, action: 'owner.photo_upload', objectType: 'place', objectId: ctx.placeId, payload: { url: stored.url } })
  await refresh(ctx.placeId)
  return { success: true }
}

/** Elimina una foto propia. Las de otros orígenes (Google, usuarios) no las borra el dueño. */
export async function deleteOwnerPhoto(formData: FormData) {
  const photoId = formData.get('photo_id')
  if (!isUuid(photoId)) return { error: 'Foto inválida' }
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }

  const admin = createAdminClient()
  // La foto debe ser de ESTE lugar y de origen 'owner'.
  const { data: row } = await admin.from('place_photos').select('id, url, storage_path')
    .eq('id', photoId).eq('place_id', ctx.placeId).eq('source', 'owner').maybeSingle()
  const photo = row as { id: string; url: string; storage_path: string | null } | null
  if (!photo) return { error: 'Foto no encontrada' }

  const { error } = await admin.from('place_photos').delete().eq('id', photo.id).eq('place_id', ctx.placeId)
  if (error) {
    console.error('[deleteOwnerPhoto]', error.message)
    return { error: 'No pudimos eliminar la foto. Intenta de nuevo.' }
  }
  if (photo.storage_path?.startsWith(`owner/${ctx.placeId}/`)) await admin.storage.from(BUCKET).remove([photo.storage_path])

  await audit({ userId: ctx.user.id, action: 'owner.photo_delete', objectType: 'photo', objectId: photo.id, payload: { place_id: ctx.placeId, url: photo.url } })
  await refresh(ctx.placeId)
  return { success: true }
}
