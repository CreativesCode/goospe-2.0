import { describe, expect, it } from 'vitest'
import { pageCount, pageHref, pageOffset, parsePageSegment } from '@/lib/pagination'
import {
  cityCategoryPath, cityPath, eventIcsPath, eventOgPath, eventPath, isGooglePhotoProxy, isMalformedSeoPath, isSlug,
  listingHeadline, metaDescription, placeOgPath, placeShareImage,
} from '@/features/places/seo-routes'

describe('paginación en la ruta', () => {
  it('parsePageSegment solo acepta enteros canónicos ≥ 1', () => {
    expect(parsePageSegment('1')).toBe(1)
    expect(parsePageSegment('2')).toBe(2)
    expect(parsePageSegment('62')).toBe(62)
    for (const bad of ['0', '02', '-1', '1.5', '2a', 'comer', '', ' 2', '1e3', '999999']) {
      expect(parsePageSegment(bad)).toBeNull()
    }
    expect(parsePageSegment(undefined)).toBeNull()
    expect(parsePageSegment(2)).toBeNull()
  })

  it('pageCount', () => {
    expect(pageCount(0, 24)).toBe(1)
    expect(pageCount(1, 24)).toBe(1)
    expect(pageCount(24, 24)).toBe(1)
    expect(pageCount(25, 24)).toBe(2)
    expect(pageCount(1481, 24)).toBe(62)
    expect(pageCount(10, 0)).toBe(1)
  })

  it('pageOffset', () => {
    expect(pageOffset(1, 24)).toBe(0)
    expect(pageOffset(3, 24)).toBe(48)
    expect(pageOffset(0, 24)).toBe(0)
  })

  it('pageHref: la primera página es la ruta limpia', () => {
    expect(pageHref('/c/granada-es', 1)).toBe('/c/granada-es')
    expect(pageHref('/c/granada-es', 2)).toBe('/c/granada-es/2')
    expect(pageHref('/c/granada-es/comer', 3)).toBe('/c/granada-es/comer/3')
  })
})

describe('rutas', () => {
  it('isSlug', () => {
    for (const ok of ['puerto-varas', 'granada-es', 'cafe', 'nina-n13649958595', 'a1']) expect(isSlug(ok)).toBe(true)
    for (const bad of ['', 'Granada', 'puerto varas', '-x', 'x-', 'a--b', 'café', '../etc', 'a/b', 'a'.repeat(81)]) {
      expect(isSlug(bad)).toBe(false)
    }
    expect(isSlug(null)).toBe(false)
    expect(isSlug(['cafe'])).toBe(false)
  })

  it('las rutas de listado cuelgan de /c y no chocan con rutas de primer nivel', () => {
    expect(cityPath('events')).toBe('/c/events') // una ciudad llamada "events" no pisa /events
    expect(cityCategoryPath('granada-es', 'comer')).toBe('/c/granada-es/comer')
    expect(eventPath('id')).toBe('/events/id')
    expect(eventOgPath('id')).toBe('/events/id/og')
    expect(eventIcsPath('id')).toBe('/events/id/ics')
  })

  it('un slug de categoría nunca se confunde con un número de página', () => {
    for (const category of ['comer', 'cafe', 'beber', 'noche', 'eventos']) expect(parsePageSegment(category)).toBeNull()
  })

  it('listingHeadline', () => {
    expect(listingHeadline('Granada')).toBe('Qué hacer en Granada')
    expect(listingHeadline('Granada', { slug: 'comer', name: 'Comer' })).toBe('Dónde comer en Granada')
    expect(listingHeadline('Granada', { slug: 'cafe', name: 'Café' })).toBe('Cafés en Granada')
    expect(listingHeadline('Granada', { slug: 'museos', name: 'Museos' })).toBe('Museos en Granada')
  })
})

describe('placeShareImage', () => {
  const google = { url: '/api/place-photo?name=places%2FChIJ&w=800', status: 'approved' }
  const own = { url: 'https://x.supabase.co/storage/v1/object/public/places/a.jpg', status: 'approved' }
  const pending = { url: 'https://x.supabase.co/storage/v1/object/public/places/p.jpg', status: 'pending' }
  const cover = 'https://x.supabase.co/storage/v1/object/public/places/cover.jpg'

  it('la portada del dueño va primero', () => {
    expect(placeShareImage('nina', cover, [google, own])).toBe(cover)
  })

  it('sin portada, la primera foto aprobada que NO sea de Google', () => {
    expect(placeShareImage('nina', null, [google, pending, own])).toBe(own.url)
  })

  it('solo fotos de Google (o ninguna) → imagen generada, nunca el proxy', () => {
    expect(placeShareImage('nina', null, [google])).toBe(placeOgPath('nina'))
    expect(placeShareImage('nina', '', [])).toBe('/places/nina/og')
    expect(placeShareImage('nina', undefined, null)).toBe('/places/nina/og')
    expect(placeShareImage('nina', null, [pending])).toBe('/places/nina/og')
  })

  it('una portada que apunta al proxy de Google tampoco se usa', () => {
    expect(placeShareImage('nina', google.url, [own])).toBe(own.url)
    expect(isGooglePhotoProxy(google.url)).toBe(true)
    expect(isGooglePhotoProxy(own.url)).toBe(false)
  })
})

describe('metaDescription', () => {
  it('colapsa espacios y deja pasar textos cortos', () => {
    expect(metaDescription('  Café   de\nespecialidad ')).toBe('Café de especialidad')
    expect(metaDescription(null)).toBe('')
  })

  it('corta en palabra completa y añade puntos suspensivos', () => {
    const out = metaDescription('palabra '.repeat(40), 60)
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.endsWith('…')).toBe(true)
    expect(out).toMatch(/palabra…$/)
  })
})

describe('isMalformedSeoPath: URL basura que el proxy corta con 404', () => {
  it('deja pasar las rutas con forma válida (existan o no en la BD)', () => {
    for (const ok of [
      '/c/puerto-varas', '/c/puerto-varas/', '/c/granada-es/comer', '/c/granada-es/2', '/c/granada-es/comer/3',
      '/c/nope', '/c/nope/nada', '/events/41b88085-6cb2-4f42-9a4c-750575907149',
      '/events/00000000-0000-4000-8000-000000000000',
    ]) expect(isMalformedSeoPath(ok), ok).toBe(false)
  })
  it('corta ciudad, categoría o página con forma imposible', () => {
    for (const bad of [
      '/c/Foo!', '/c/Puerto-Varas', '/c/x%20y', '/c/x/1', '/c/x/0', '/c/x/02', '/c/x/999999', '/c/x/Comer',
      '/c/x/comer/1', '/c/x/comer/abc', '/c/x/comer/02', '/c/x/2/3', '/c/-x', '/c/' + 'a'.repeat(81),
    ]) expect(isMalformedSeoPath(bad), bad).toBe(true)
  })
  it('corta ids de evento que no son un uuid', () => {
    for (const bad of ['/events/abc', '/events/123', '/events/41b88085-6cb2-4f42-9a4c', '/events/%00'])
      expect(isMalformedSeoPath(bad), bad).toBe(true)
  })
  it('no toca el resto del sitio', () => {
    for (const other of [
      '/', '/events', '/events/', '/c', '/feed', '/places/bahia-n903040122', '/categorias/x',
      '/events/abc/og', '/events/abc/ics', '/c/a/b/c/d',
    ]) expect(isMalformedSeoPath(other), other).toBe(false)
  })
})
