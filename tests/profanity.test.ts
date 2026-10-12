import { describe, expect, it } from 'vitest'
import { containsProfanity } from '@/lib/profanity'

describe('containsProfanity', () => {
  it('vacío o nulo no es grosería', () => {
    expect(containsProfanity(null)).toBe(false)
    expect(containsProfanity(undefined)).toBe(false)
    expect(containsProfanity('')).toBe(false)
  })

  it.each([
    'Muy económico y rico',
    'Lo conocí el verano pasado',
    'Tienen un computador para los clientes',
    'Hubo una disputa por la cuenta',
    'Buena reputación en el barrio',
    'Un cono de helado gigante',
    'Pedí la pollada y el concho de vino', // contienen "polla" y "conch" como subcadena
    'Voy a ir y o no vuelvo', // palabras de una letra sueltas
    'Excelente atención, 10/10. ¡Volveré!',
  ])('no marca texto normal: %s', (text) => {
    expect(containsProfanity(text)).toBe(false)
  })

  it.each([
    'puta',
    'PUTA la cuestión',
    'Esto es una mierda.',
    'el dueño es un weón',
    'qué huevón más pesado',
    'Huevon',
    'conchetumadre',
    'ctm!!',
    '¡coño!',
    'son unos pendejos',
    'las putas colas',
    'imbécil',
  ])('atrapa groserías reales: %s', (text) => {
    expect(containsProfanity(text)).toBe(true)
  })

  it.each([
    'p u t a',
    'P U T A',
    'p-u-t-a',
    'm.i.e.r.d.a',
    'puuuuta',
    'mieeerda de lugar',
    'eres una p u t a madre',
    'es una p u t a y punto', // la "y" suelta no debe esconder la palabra
    'vete a m i e r d a', // ni la "a" que la precede
  ])('atrapa evasiones simples: %s', (text) => {
    expect(containsProfanity(text)).toBe(true)
  })

  it('conserva la ñ: "coño" es grosería, "cono" no', () => {
    expect(containsProfanity('coño')).toBe(true)
    expect(containsProfanity('cono')).toBe(false)
  })
})
