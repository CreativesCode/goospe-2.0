'use client'

import { useSyncExternalStore } from 'react'
import {
  CITY_COOKIE, CITY_COOKIE_MAX_AGE, CITY_EVENT,
  cityChoiceFromCookieHeader, matchActiveCity, parseCityChoice, serializeCityChoice, toChoice,
  type ActiveCity, type CityChoice,
} from '@/lib/city-choice'

// Ciudad elegida a mano (selector de ciudad). Se guarda en dos sitios:
//  · cookie `goospe_city`  → la puede leer el servidor (src/lib/city-choice-server.ts)
//  · localStorage          → respaldo si el navegador borra o bloquea la cookie
// Es por dispositivo. Para un usuario con sesión viaja con su navegador, no con su cuenta
// (ver "decisiones abiertas" del informe de la fase 7).
const STORAGE_KEY = 'goospe:city'

let cached: { raw: string | null; value: CityChoice | null } | null = null

function readRaw(): string | null {
  if (typeof document === 'undefined') return null
  const fromCookie = cityChoiceFromCookieHeader(document.cookie)
  if (fromCookie) return serializeCityChoice(fromCookie)
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

/** Ciudad elegida, o null si el usuario va por geolocalización ("cerca de mí"). */
export function getCityChoice(): CityChoice | null {
  const raw = readRaw()
  // Misma referencia mientras no cambie el valor (lo exige useSyncExternalStore).
  if (!cached || cached.raw !== raw) cached = { raw, value: parseCityChoice(raw) }
  return cached.value
}

function writeCookie(value: string | null) {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = value
    ? `${CITY_COOKIE}=${value}; Path=/; Max-Age=${CITY_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
    : `${CITY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

/** Fija la ciudad (o la limpia con null → vuelve a "cerca de mí") y avisa a quien escuche. */
export function setCityChoice(city: CityChoice | ActiveCity | null) {
  if (typeof document === 'undefined') return
  const value = city ? serializeCityChoice(toChoice(city)) : null
  try {
    writeCookie(value)
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* modo privado / almacenamiento bloqueado: al menos queda la cookie */
  }
  cached = null
  window.dispatchEvent(new Event(CITY_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CITY_EVENT, onChange)
  window.addEventListener('storage', onChange) // otra pestaña cambió la ciudad
  return () => {
    window.removeEventListener(CITY_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Ciudad elegida, reactiva. En el servidor y durante la hidratación es null. */
export function useCityChoice(): CityChoice | null {
  return useSyncExternalStore(subscribe, getCityChoice, () => null)
}

// ── lista de ciudades (una sola petición por sesión de página) ───────────────────────────────
let citiesPromise: Promise<ActiveCity[]> | null = null

/**
 * Ciudad elegida, VALIDADA contra las ciudades activas (/api/cities). La cookie y localStorage
 * los escribe el navegador: pueden traer una ciudad que se desactivó o una inventada. Si no es
 * una ciudad activa se borra la elección (todo vuelve a "cerca de mí") y se devuelve null. La
 * ciudad válida sale con el nombre y el centro del SERVIDOR, no con los guardados. Si la lista
 * no se puede cargar no hay cómo comprobarla: se ignora por esta vez (sin borrarla).
 */
export async function resolveCityChoice(): Promise<CityChoice | null> {
  const choice = getCityChoice()
  if (!choice) return null
  let active: ActiveCity[]
  try {
    active = await fetchActiveCities()
  } catch {
    return null
  }
  const match = matchActiveCity(choice, active)
  if (match) return toChoice(match)
  setCityChoice(null)
  return null
}

export function fetchActiveCities(): Promise<ActiveCity[]> {
  if (!citiesPromise) {
    citiesPromise = fetch('/api/cities')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`cities ${r.status}`))))
      .then((d: { cities?: ActiveCity[] }) => {
        const list = d.cities ?? []
        if (!list.length) throw new Error('cities vacío')
        return list
      })
      .catch((e) => {
        citiesPromise = null // permite reintentar
        throw e
      })
  }
  return citiesPromise
}
