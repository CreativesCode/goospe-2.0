// Ruta del objeto dentro de un bucket público de Supabase Storage a partir de su URL pública.
// Sirve para borrar el archivo anterior al reemplazar portada / logo. Devuelve null si la URL
// no es de ese bucket (p. ej. una foto de Google) o intenta salir de la carpeta permitida.
export function storagePathFromUrl(url: string | null | undefined, bucket: string, prefix = ''): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const at = url.indexOf(marker)
  if (at < 0) return null
  let path: string
  try {
    path = decodeURIComponent(url.slice(at + marker.length).split(/[?#]/)[0])
  } catch {
    return null
  }
  if (!path || path.includes('..') || path.startsWith('/')) return null
  return path.startsWith(prefix) ? path : null
}
