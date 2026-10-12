// Sanea el destino de `?next=`: sólo rutas INTERNAS. Evita open redirect
// (//evil.com, /\evil.com, https://…, saltos de línea). Sirve en cliente y servidor.
export function safeNext(v: unknown, fallback = '/feed'): string {
  if (typeof v !== 'string') return fallback
  if (v.length === 0 || v.length > 2000) return fallback
  if (!v.startsWith('/')) return fallback
  if (v.startsWith('//') || v.startsWith('/\\')) return fallback
  // Sin backslashes (los navegadores los tratan como '/'), caracteres de control ni esquema.
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return fallback
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(v)) return fallback
  return v
}
