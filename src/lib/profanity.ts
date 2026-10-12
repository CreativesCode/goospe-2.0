// Filtro de groserías mínimo para contenido generado por usuarios (reseñas, fotos, etc.).
// No pretende ser exhaustivo: bloquea insultos evidentes en español para el piloto.
// Compara PALABRAS completas (antes buscaba subcadenas sobre el texto sin espacios y
// rechazaba "económico", "conocí" o "computador"). Sigue atrapando evasiones simples:
// letras separadas ("p u t a", "p-u-t-a") y letras estiradas ("puuuta"). Ante duda, deja pasar.

const BLOCKLIST = [
  'puta', 'puto', 'putos', 'putas', 'mierda', 'concha', 'conchetumadre', 'ctm',
  'weón', 'weon', 'wea', 'huevón', 'huevon', 'culiao', 'culiado', 'maricon', 'maricón',
  'imbecil', 'imbécil', 'idiota', 'estupido', 'estúpido', 'pendejo', 'pendeja',
  'verga', 'pija', 'polla', 'coño', 'cabron', 'cabrón', 'joder', 'gilipollas', 'zorra',
]

// Minúsculas y sin acentos, CONSERVANDO la ñ: NFD la partiría en n + tilde y "coño" pasaría
// a "cono" (de ahí el falso positivo con "conocí"). Se protege con un marcador temporal.
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
}

const BLOCKED = new Set(BLOCKLIST.map(fold))

// Palabras del texto. Las rachas de letras sueltas ("p u t a") se unen en una sola palabra.
function tokenize(text: string): string[] {
  const words = fold(text).split(/[^a-zñ]+/).filter(Boolean)
  const out: string[] = []
  let run = ''
  for (const w of words) {
    if (w.length === 1) { run += w; continue }
    if (run) { out.push(run); run = '' }
    out.push(w)
  }
  if (run) out.push(run)
  return out
}

const isBlocked = (w: string) => BLOCKED.has(w) || (w.endsWith('s') && BLOCKED.has(w.slice(0, -1)))

// true si el texto contiene una palabra de la blocklist.
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false
  return tokenize(text).some((w) => isBlocked(w) || isBlocked(w.replace(/(.)\1{2,}/g, '$1')))
}
