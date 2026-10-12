import { describe, expect, it } from 'vitest'
import { fitWithin, formatBytes, needsResize, outputMime, renameFor, RESIZE_PRESETS } from '@/lib/image-resize'

describe('fitWithin', () => {
  it('reduce el lado largo a maxSide conservando la proporción', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scale: 0.4 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600, scale: 0.4 })
    expect(fitWithin(2048, 2048, 512)).toMatchObject({ width: 512, height: 512 })
  })

  it('nunca agranda', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600, scale: 1 })
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900, scale: 1 })
    expect(fitWithin(100, 100, 512).scale).toBe(1)
  })

  it('redondea y no deja lados en 0 (panorámicas extremas)', () => {
    expect(fitWithin(4001, 3001, 1600)).toMatchObject({ width: 1600, height: 1200 })
    expect(fitWithin(10000, 2, 1600)).toMatchObject({ width: 1600, height: 1 })
  })

  it('entradas raras no rompen', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 1, height: 1, scale: 1 })
    expect(fitWithin(500, 400, 0)).toEqual({ width: 500, height: 400, scale: 1 })
  })
})

describe('needsResize', () => {
  const { photo, logo } = RESIZE_PRESETS
  it('se salta lo que ya es chico y liviano', () => {
    expect(needsResize(1200, 800, 300 * 1024, photo)).toBe(false)
    expect(needsResize(1600, 1600, photo.skipBytes, photo)).toBe(false)
    expect(needsResize(400, 400, 80 * 1024, logo)).toBe(false)
  })
  it('procesa lo grande en píxeles o en peso', () => {
    expect(needsResize(4000, 3000, 300 * 1024, photo)).toBe(true)
    expect(needsResize(1200, 800, 3 * 1024 * 1024, photo)).toBe(true) // cabe, pero pesa: se recomprime
    expect(needsResize(1024, 1024, 80 * 1024, logo)).toBe(true)
  })
})

describe('outputMime / renameFor / formatBytes', () => {
  it('JPEG se queda en JPEG; PNG y WebP conservan transparencia', () => {
    expect(outputMime('image/jpeg', true)).toBe('image/jpeg')
    expect(outputMime('image/jpeg', false)).toBe('image/jpeg')
    expect(outputMime('image/png', true)).toBe('image/webp')
    expect(outputMime('image/webp', true)).toBe('image/webp')
    expect(outputMime('image/png', false)).toBe('image/png')
    expect(outputMime('image/webp', false)).toBe('image/jpeg')
    expect(outputMime('', false)).toBe('image/jpeg')
  })
  it('renombra con la extensión de salida', () => {
    expect(renameFor('IMG 01.HEIC', 'image/jpeg')).toBe('IMG 01.jpg')
    expect(renameFor('logo.final.png', 'image/webp')).toBe('logo.final.webp')
    expect(renameFor('sinextension', 'image/png')).toBe('sinextension.png')
    expect(renameFor('.jpg', 'image/jpeg')).toBe('imagen.jpg')
  })
  it('pesos legibles', () => {
    expect(formatBytes(3.24 * 1024 * 1024)).toBe('3,2 MB')
    expect(formatBytes(410 * 1024)).toBe('410 KB')
    expect(formatBytes(10)).toBe('1 KB')
  })
})
