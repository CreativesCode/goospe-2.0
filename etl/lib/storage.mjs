import { createHash } from 'node:crypto'

// Descarga una imagen externa y la sube al bucket de Storage; devuelve la URL pública + path.
export function createStorage(sb, bucket = 'places') {
  async function uploadFromUrl(url, placeId, source) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    const ct = res.headers.get('content-type') || 'image/jpeg'
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
    const buf = Buffer.from(await res.arrayBuffer())
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 12)
    const path = `${placeId}/${source}-${hash}.${ext}`
    const { error } = await sb.storage.from(bucket).upload(path, buf, { contentType: ct, upsert: true })
    if (error) throw error
    const { data } = sb.storage.from(bucket).getPublicUrl(path)
    return { publicUrl: data.publicUrl, path, bytes: buf.length }
  }
  return { uploadFromUrl }
}
