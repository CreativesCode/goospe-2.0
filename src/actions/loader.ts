'use server'

import { spawn } from 'node:child_process'
import { z } from 'zod'
import { isLocalhostRequest } from '@/lib/local-only'
import { countryByCode } from '@/features/loader/data/geo-catalog'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

// Cargador de zonas — SOLO local. Resuelve ciudades vía Nominatim (devuelve bbox para Overpass).

const searchSchema = z.object({
  countryCode: z.string().length(2),
  region: z.string().min(1),
  q: z.string().min(2).max(80),
})

export type ZoneCandidate = {
  name: string
  displayName: string
  lat: number
  lng: number
  bbox: [number, number, number, number] // [sur, oeste, norte, este]
  type: string
}

export type SearchResult = { candidates: ZoneCandidate[] } | { error: string }

export async function searchZoneCities(input: unknown): Promise<SearchResult> {
  if (!(await isLocalhostRequest())) return { error: 'El cargador solo está disponible en localhost.' }
  const parsed = searchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Parámetros de búsqueda inválidos.' }

  const { countryCode, region, q } = parsed.data
  const country = countryByCode(countryCode)
  if (!country) return { error: 'País no soportado por el catálogo.' }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('city', q)
  url.searchParams.set('state', region)
  url.searchParams.set('countrycodes', countryCode.toLowerCase()) // matching robusto por ISO2
  url.searchParams.set('country', country.name)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'goospe-loader/0.1 (admin local; contact: titanicfactorymedia@gmail.com)' },
    })
    if (!res.ok) return { error: `Nominatim respondió ${res.status}` }
    const rows = (await res.json()) as Array<{
      display_name: string
      name?: string
      lat: string
      lon: string
      boundingbox: [string, string, string, string]
      type: string
      addresstype?: string
    }>
    const candidates: ZoneCandidate[] = rows.map((r) => {
      // Nominatim boundingbox = [sur, norte, oeste, este]; nuestro bbox = [sur, oeste, norte, este].
      const [s, n, w, e] = r.boundingbox.map(Number)
      return {
        name: r.name || r.display_name.split(',')[0],
        displayName: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        bbox: [s, w, n, e],
        type: r.addresstype || r.type,
      }
    })
    return { candidates }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ---- Lanzar la carga de una zona ----

const startSchema = z.object({
  countryCode: z.string().length(2),
  region: z.string().min(1),
  cityName: z.string().min(1).max(120),
  lat: z.number(),
  lng: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
})

export type StartResult = { jobId: string } | { error: string }

// Crea el region_job (status queued) y lanza el ETL en un proceso aparte (fuera del request).
// SOLO local: el spawn de node + las llaves viven en la máquina del dev.
export async function startZoneLoad(input: unknown): Promise<StartResult> {
  if (!(await isLocalhostRequest())) return { error: 'El cargador solo está disponible en localhost.' }

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return { error: 'No autorizado.' }

  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos de zona inválidos.' }
  const { countryCode, region, cityName, lat, lng, bbox } = parsed.data
  const country = countryByCode(countryCode)
  if (!country) return { error: 'País no soportado.' }

  // Timezone real desde las coordenadas (tz-lookup) → "abierto ahora" correcto en cualquier país.
  let timezone = 'UTC'
  try {
    const mod = await import('tz-lookup')
    const tzlookup = (mod as unknown as { default?: (lat: number, lng: number) => string }).default ?? (mod as unknown as (lat: number, lng: number) => string)
    timezone = tzlookup(lat, lng) || 'UTC'
  } catch { /* deja UTC si falla */ }

  // El bbox guarda el objeto-zona completo que consume el pipeline (normalizeZone).
  const zone = { bbox, center: { lat, lng }, slug: `${slugify(cityName)}-${countryCode.toLowerCase()}`, timezone }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('region_jobs')
    .insert({
      country: country.name,
      region,
      city_name: cityName,
      bbox: zone,
      status: 'queued',
      created_by: user.id,
    } as never)
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'No se pudo crear el job.' }
  const jobId = (data as { id: string }).id

  try {
    const child = spawn(process.execPath, ['etl/run-zone.mjs', '--job', jobId], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch (e) {
    await admin.from('region_jobs').update({ status: 'error', error: `spawn: ${(e as Error).message}` } as never).eq('id', jobId)
    return { error: `No se pudo lanzar el runner: ${(e as Error).message}` }
  }

  return { jobId }
}
