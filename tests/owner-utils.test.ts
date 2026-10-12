import { describe, expect, it } from 'vitest'
import { diffFields } from '@/lib/audit-diff'
import { sniffImage } from '@/lib/image-sniff'
import { parseLatLng } from '@/lib/latlng'
import { storagePathFromUrl } from '@/lib/storage-path'
import { isoToLocalInZone, zonedTimeToUtc } from '@/lib/tz'
import { safeInternalLink, timeAgo } from '@/features/notifications/format'

describe('sniffImage', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)])

  it('reconoce JPG, PNG y WebP por sus magic bytes', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ mime: 'image/png', ext: 'png' })
    const webp = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), 0, 0])
    expect(sniffImage(webp)).toEqual({ mime: 'image/webp', ext: 'webp' })
  })

  it('rechaza lo que no es imagen aunque el nombre diga otra cosa', () => {
    expect(sniffImage(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')))).toBeNull()
    expect(sniffImage(new Uint8Array(Buffer.from('<!doctype html><html>')))).toBeNull()
    expect(sniffImage(new Uint8Array(Buffer.from('GIF89a')))).toBeNull()
    expect(sniffImage(new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')]))).toBeNull()
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull() // truncado
    expect(sniffImage(new Uint8Array())).toBeNull()
  })
})

describe('parseLatLng', () => {
  it('par de coordenadas', () => {
    expect(parseLatLng('-41.3195, -72.9854')).toEqual({ lat: -41.3195, lng: -72.9854 })
    expect(parseLatLng('  28.1235;-15.4363 ')).toEqual({ lat: 28.1235, lng: -15.4363 })
    expect(parseLatLng('40.4168 -3.7038')).toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('enlaces de mapa', () => {
    expect(parseLatLng('https://www.google.com/maps/place/Caf%C3%A9/@-41.3190,-72.9850,17z/data=!3m1!4b1!4m6!3m5!8m2!3d-41.3195!4d-72.9854'))
      .toEqual({ lat: -41.3195, lng: -72.9854 }) // el pin exacto gana al centro del visor
    expect(parseLatLng('https://www.google.com/maps/@-41.319,-72.985,17z')).toEqual({ lat: -41.319, lng: -72.985 })
    expect(parseLatLng('https://maps.google.com/?q=-41.3195,-72.9854')).toEqual({ lat: -41.3195, lng: -72.9854 })
    expect(parseLatLng('https://www.google.com/maps/search/?api=1&query=40.4168%2C-3.7038')).toEqual({ lat: 40.4168, lng: -3.7038 })
    expect(parseLatLng('https://www.openstreetmap.org/?mlat=-41.3195&mlon=-72.9854#map=18/-41.3195/-72.9854')).toEqual({ lat: -41.3195, lng: -72.9854 })
    expect(parseLatLng('https://www.openstreetmap.org/#map=18/40.4168/-3.7038')).toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('sin coordenadas o fuera de rango -> null', () => {
    expect(parseLatLng('https://maps.app.goo.gl/AbCdEf123')).toBeNull() // enlace corto: no trae coordenadas
    expect(parseLatLng('Frente a la plaza, al lado del banco')).toBeNull()
    expect(parseLatLng('91.5, 10')).toBeNull()
    expect(parseLatLng('10, 181')).toBeNull()
    expect(parseLatLng('')).toBeNull()
    expect(parseLatLng(null)).toBeNull()
  })
})

describe('storagePathFromUrl', () => {
  const base = 'https://x.supabase.co/storage/v1/object/public/places/'

  it('extrae la ruta del objeto dentro del bucket', () => {
    expect(storagePathFromUrl(`${base}owner/abc/cover-1.jpg`, 'places')).toBe('owner/abc/cover-1.jpg')
    expect(storagePathFromUrl(`${base}owner/abc/cover-1.jpg?v=2`, 'places', 'owner/abc/')).toBe('owner/abc/cover-1.jpg')
  })

  it('no devuelve rutas ajenas al lugar ni al bucket', () => {
    expect(storagePathFromUrl(`${base}owner/otro/cover-1.jpg`, 'places', 'owner/abc/')).toBeNull()
    expect(storagePathFromUrl(`${base}owner/abc/../otro/x.jpg`, 'places', 'owner/abc/')).toBeNull()
    expect(storagePathFromUrl(`${base}owner/abc/%2E%2E/otro/x.jpg`, 'places', 'owner/abc/')).toBeNull()
    expect(storagePathFromUrl('/api/place-photo?ref=abc&w=800', 'places')).toBeNull()
    expect(storagePathFromUrl('https://x.supabase.co/storage/v1/object/public/otros/a.jpg', 'places')).toBeNull()
    expect(storagePathFromUrl(null, 'places')).toBeNull()
  })
})

describe('diffFields', () => {
  it('solo lo que cambió, con antes y después', () => {
    expect(diffFields({ phone: '1', email: null, tags: ['a'] }, { phone: '2', email: null, tags: ['a'] }))
      .toEqual({ phone: { before: '1', after: '2' } })
    expect(diffFields({ tags: ['a'] }, { tags: ['a', 'b'] })).toEqual({ tags: { before: ['a'], after: ['a', 'b'] } })
    expect(diffFields({ a: 1 }, { a: 1 })).toEqual({})
  })

  it('undefined y null se consideran iguales; sin "antes" todo es nuevo', () => {
    expect(diffFields({}, { email: null })).toEqual({})
    expect(diffFields(null, { email: 'a@b.cl' })).toEqual({ email: { before: null, after: 'a@b.cl' } })
  })

  it('recorta los textos largos', () => {
    const d = diffFields({ description: 'a'.repeat(500) }, { description: 'b'.repeat(500) })
    expect((d.description.before as string).length).toBe(201)
    expect((d.description.after as string).endsWith('…')).toBe(true)
  })
})

describe('notificaciones', () => {
  it('safeInternalLink solo deja rutas internas', () => {
    expect(safeInternalLink('/panel/abc#resenas')).toBe('/panel/abc#resenas')
    expect(safeInternalLink('//evil.com')).toBeNull()
    expect(safeInternalLink('https://evil.com')).toBeNull()
    expect(safeInternalLink('javascript:alert(1)')).toBeNull()
    expect(safeInternalLink('/\\evil.com')).toBeNull()
    expect(safeInternalLink(null)).toBeNull()
  })

  it('timeAgo', () => {
    const now = new Date('2026-10-12T12:00:00Z').getTime()
    expect(timeAgo('2026-10-12T11:59:40Z', now)).toBe('ahora')
    expect(timeAgo('2026-10-12T11:15:00Z', now)).toBe('hace 45 min')
    expect(timeAgo('2026-10-12T07:00:00Z', now)).toBe('hace 5 h')
    expect(timeAgo('2026-10-09T12:00:00Z', now)).toBe('hace 3 d')
    expect(timeAgo('no es fecha', now)).toBe('')
  })
})

describe('isoToLocalInZone', () => {
  it('es el inverso de zonedTimeToUtc en cada zona', () => {
    for (const tz of ['America/Santiago', 'Europe/Madrid', 'Atlantic/Canary']) {
      for (const local of ['2026-07-15T20:30', '2026-12-31T23:45', '2026-01-10T08:00']) {
        expect(isoToLocalInZone(zonedTimeToUtc(local, tz)!.toISOString(), tz)).toBe(local)
      }
    }
  })

  it('fecha inválida -> cadena vacía', () => {
    expect(isoToLocalInZone('x', 'Europe/Madrid')).toBe('')
  })
})
