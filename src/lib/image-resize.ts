// Redimensionado de imágenes EN EL NAVEGADOR antes de subirlas (canvas). Una foto de móvil pesa
// 3–8 MB y la ficha nunca la muestra a más de ~1600 px: subir el original gasta datos del dueño
// y choca con el tope de 5 MB. El servidor sigue siendo la autoridad (magic bytes y tamaño en
// src/lib/image-sniff.ts): esto es solo una optimización y, si algo falla, se sube el original.

export type OutputMime = 'image/jpeg' | 'image/webp' | 'image/png'
export type ResizePreset = {
  /** Lado largo máximo en píxeles. Nunca se agranda una imagen más chica. */
  maxSide: number
  /** Una imagen que ya cabe en maxSide y pesa hasta esto se sube tal cual. */
  skipBytes: number
}

export const RESIZE_QUALITY = 0.82
export const RESIZE_PRESETS = {
  /** Portada, fotos propias, fotos de usuarios e imagen de evento. */
  photo: { maxSide: 1600, skipBytes: 600 * 1024 },
  logo: { maxSide: 512, skipBytes: 150 * 1024 },
  /** Carta para lectura automática: algo más grande para que el texto chico siga legible. */
  menu: { maxSide: 2000, skipBytes: 900 * 1024 },
} as const satisfies Record<string, ResizePreset>

export type ResizeResult = {
  /** Lo que hay que subir: la versión optimizada o, si no convenía o falló, el original. */
  file: File
  resized: boolean
  originalBytes: number
  /** Por qué se conservó el original (ausente si se optimizó). */
  kept?: 'already-small' | 'not-smaller' | 'failed'
}

/** Dimensiones finales para que el lado largo no pase de maxSide, conservando la proporción. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number; scale: number } {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const long = Math.max(w, h)
  if (!Number.isFinite(long) || !(maxSide > 0) || long <= maxSide) return { width: w, height: h, scale: 1 }
  const scale = maxSide / long
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale }
}

/** true si conviene pasar la imagen por el canvas: es más grande que maxSide o pesa de más. */
export function needsResize(width: number, height: number, bytes: number, preset: ResizePreset): boolean {
  return Math.max(width, height) > preset.maxSide || bytes > preset.skipBytes
}

/**
 * Formato de salida. Un JPEG sigue siendo JPEG (máxima compatibilidad). PNG y WebP pueden traer
 * transparencia (logos): salen como WebP, que la conserva; si el navegador no sabe codificar
 * WebP, el PNG sigue siendo PNG y el resto cae a JPEG.
 */
export function outputMime(sourceMime: string, canEncodeWebp: boolean): OutputMime {
  if (sourceMime === 'image/jpeg') return 'image/jpeg'
  if (canEncodeWebp) return 'image/webp'
  return sourceMime === 'image/png' ? 'image/png' : 'image/jpeg'
}

const EXT: Record<OutputMime, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }

/** Nombre del archivo con la extensión del formato de salida ("IMG 01.HEIC" -> "IMG 01.jpg"). */
export function renameFor(name: string, mime: OutputMime): string {
  const base = name.replace(/\.[^./\\]*$/, '').trim() || 'imagen'
  return `${base}.${EXT[mime]}`
}

/** "3,2 MB" / "410 KB" para mostrar el ahorro. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

// Decodifica respetando la orientación EXIF: createImageBitmap con 'from-image' y, si no existe
// o falla (Safari antiguo), un <img>, que los navegadores actuales también dibujan ya orientado.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      /* se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

const toBlob = (canvas: HTMLCanvasElement, mime: OutputMime): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : RESIZE_QUALITY))

async function encode(img: Decoded, width: number, height: number, sourceMime: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const draw = (mime: OutputMime) => {
    ctx.clearRect(0, 0, width, height)
    if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height) } // JPEG no tiene transparencia
    ctx.drawImage(img.source, 0, 0, width, height)
  }

  const wanted = outputMime(sourceMime, true)
  draw(wanted)
  const first = await toBlob(canvas, wanted)
  if (first && first.type === wanted) return first
  // El navegador no codifica WebP (devuelve PNG o nada): segundo intento con el formato de reserva.
  const fallback = outputMime(sourceMime, false)
  if (fallback === wanted) return null
  draw(fallback)
  const second = await toBlob(canvas, fallback)
  return second && second.type === fallback ? second : null
}

/**
 * Devuelve la imagen lista para subir. Nunca lanza y nunca agranda: ante cualquier fallo (canvas
 * no disponible, formato que el navegador no decodifica, sin memoria) entrega el original y deja
 * que el servidor decida.
 */
export async function resizeImage(file: File, preset: ResizePreset): Promise<ResizeResult> {
  const keep = (kept: ResizeResult['kept']): ResizeResult => ({ file, resized: false, originalBytes: file.size, kept })
  if (typeof document === 'undefined') return keep('failed')
  let img: Decoded | null = null
  try {
    img = await decode(file)
    if (!img.width || !img.height) return keep('failed')
    if (!needsResize(img.width, img.height, file.size, preset)) return keep('already-small')

    const target = fitWithin(img.width, img.height, preset.maxSide)
    const blob = await encode(img, target.width, target.height, file.type)
    if (!blob) return keep('failed')
    // No pesa menos que el original (ya venía muy comprimido): recomprimir solo perdería calidad.
    if (blob.size >= file.size) return keep('not-smaller')

    const mime = blob.type as OutputMime
    const out = new File([blob], renameFor(file.name, mime), { type: mime, lastModified: file.lastModified })
    return { file: out, resized: true, originalBytes: file.size }
  } catch {
    return keep('failed')
  } finally {
    img?.close()
  }
}
