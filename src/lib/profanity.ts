// Filtro de groserías mínimo para contenido generado por usuarios (reseñas, fotos, etc.).
// No pretende ser exhaustivo: bloquea insultos evidentes en español para el piloto.
// Normaliza acentos y separadores comunes (espacios/puntos/guiones entre letras) para
// atrapar evasiones simples ("i d i o t a", "p-u-t-a"). Ante duda, deja pasar.

const BLOCKLIST = [
  'puta', 'puto', 'putos', 'putas', 'mierda', 'concha', 'conchetumadre', 'ctm',
  'weón', 'weon', 'wea', 'huevón', 'huevon', 'culiao', 'culiado', 'maricon', 'maricón',
  'imbecil', 'imbécil', 'idiota', 'estupido', 'estúpido', 'pendejo', 'pendeja',
  'verga', 'pija', 'polla', 'coño', 'cabron', 'cabrón', 'joder', 'gilipollas', 'zorra',
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-zñ]+/g, '') // deja solo letras (incl. ñ) → colapsa "p u t a" → "puta"
}

// true si el texto contiene una palabra de la blocklist.
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false
  const flat = normalize(text)
  if (!flat) return false
  return BLOCKLIST.some((w) => flat.includes(normalize(w)))
}
