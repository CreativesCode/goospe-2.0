import 'server-only'
import { cookies } from 'next/headers'
import { getActiveCities } from '@/lib/cities'
import { CITY_COOKIE, matchActiveCity, parseCityChoice, type ActiveCity, type CityChoice } from '@/lib/city-choice'

/**
 * Ciudad elegida a mano por el usuario, leída de la cookie `goospe_city` (ver city-choice.ts).
 * null = no eligió ninguna ("cerca de mí"). Leer cookies vuelve dinámica la ruta que lo llame.
 * La cookie la escribe el navegador: úsese solo para filtrar lecturas públicas.
 */
export async function getCityChoice(): Promise<CityChoice | null> {
  const store = await cookies()
  return parseCityChoice(store.get(CITY_COOKIE)?.value)
}

/**
 * Igual que `getCityChoice`, pero VALIDADA: solo devuelve la ciudad si sigue activa, y con los
 * datos del servidor. Una cookie con una ciudad inactiva o inventada se ignora (null). Es la
 * que debe usar cualquier página que filtre por la ciudad del visitante.
 */
export async function getActiveCityChoice(): Promise<ActiveCity | null> {
  const choice = await getCityChoice()
  if (!choice) return null
  return matchActiveCity(choice, await getActiveCities())
}
