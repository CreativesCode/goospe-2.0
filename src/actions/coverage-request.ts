'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { countryByCode } from '@/features/loader/data/geo-catalog'

// Registro PASIVO de una apertura fuera de cobertura (sin email, a diferencia de joinWaitlist).
// Insert público permitido por RLS ("insert coverage_requests"); validamos aquí con Zod.
const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tz: z.string().max(80).optional(),
  locale: z.string().max(20).optional(),
})

export async function logCoverageRequest(input: unknown): Promise<void> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return // señal de demanda best-effort: nunca bloquea ni lanza

  const { lat, lng, tz, locale } = parsed.data
  const sb = await createClient()
  await sb.from('coverage_requests').insert({
    lat,
    lng,
    tz: tz ?? null,
    locale: locale ?? null,
  } as never)
}

// ---- Reverse-geocoding para el panel: traduce una zona (lat/lng) a lo que hay que poner en el
// cargador de zonas (País del catálogo → Región → Ciudad). Mismo proveedor (Nominatim) que el loader.

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Empareja el "state" de Nominatim con el nombre EXACTO de región del catálogo (lo que se elige en
// el <select> del cargador): exacto → normalizado → contiene. Devuelve null si no hay match claro.
function matchCatalogRegion(countryCode: string, rawRegion: string | null): string | null {
  if (!rawRegion) return null
  const country = countryByCode(countryCode)
  if (!country) return null
  const target = norm(rawRegion)
  return (
    country.regions.find((r) => norm(r) === target) ??
    country.regions.find((r) => norm(r).includes(target) || target.includes(norm(r))) ??
    null
  )
}

export type ResolvedZone = {
  city: string | null
  regionRaw: string | null
  catalogRegion: string | null // nombre exacto de región del catálogo (para el <select>), o null
  country: string | null
  countryCode: string | null
  inCatalog: boolean // el país existe en el catálogo del cargador
  displayName: string
}

export type ResolveResult = { zone: ResolvedZone } | { error: string }

const resolveSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export async function reverseGeocodeZone(input: unknown): Promise<ResolveResult> {
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Coordenadas inválidas.' }
  const { lat, lng } = parsed.data

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'es')
  url.searchParams.set('zoom', '10') // nivel ciudad

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'goospe-admin/0.1 (admin; contact: titanicfactorymedia@gmail.com)' },
    })
    if (!res.ok) return { error: `Nominatim respondió ${res.status}` }
    const data = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const a = data.address ?? {}
    const city = a.city || a.town || a.village || a.municipality || a.county || null
    const regionRaw = a.state || a.province || a.region || a.state_district || null
    const countryCode = a.country_code ? a.country_code.toUpperCase() : null
    const catalogCountry = countryCode ? countryByCode(countryCode) : null

    return {
      zone: {
        city,
        regionRaw,
        catalogRegion: countryCode ? matchCatalogRegion(countryCode, regionRaw) : null,
        country: catalogCountry?.name ?? a.country ?? null,
        countryCode,
        inCatalog: Boolean(catalogCountry),
        displayName: data.display_name ?? '',
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
