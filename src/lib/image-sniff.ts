// Tipo REAL de una imagen por sus magic bytes. El `file.type` lo declara el cliente y no es
// fiable: la extensión y el content-type del objeto en Storage salen siempre de aquí.
export type ImageKind = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const BAD_IMAGE_FORMAT = 'Formato no soportado (usa JPG, PNG o WebP)'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 8 && PNG.every((v, i) => b[i] === v)) return { mime: 'image/png', ext: 'png' }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}
