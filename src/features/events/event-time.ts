// Ventanas de la cartelera (Hoy / Esta semana / Próximos) y estado de un evento.
// Lógica pura: recibe "ahora" y la zona horaria de la CIUDAD del evento. Producción corre en
// UTC, así que "hoy" nunca se calcula con el reloj del servidor.

import { isoToLocalInZone } from '@/lib/tz'
import { eventEndMs } from '@/lib/ics'

export const EVENT_WINDOWS = ['hoy', 'semana', 'proximos'] as const
export type EventWindow = (typeof EVENT_WINDOWS)[number]

export const EVENT_WINDOW_LABEL: Record<EventWindow, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  proximos: 'Próximos',
}

/** Valor de `?when=` → ventana. Cualquier otra cosa es "Próximos" (todo lo que viene). */
export function parseEventWindow(value: unknown): EventWindow {
  return typeof value === 'string' && (EVENT_WINDOWS as readonly string[]).includes(value)
    ? (value as EventWindow)
    : 'proximos'
}

/** Día civil ("YYYY-MM-DD") de un instante en la zona de la ciudad. */
export function localDay(iso: string | number, tz: string | null | undefined): string {
  const value = typeof iso === 'number' ? new Date(iso).toISOString() : iso
  return isoToLocalInZone(value, tz).slice(0, 10)
}

/** Suma días a un día civil sin pasar por zonas horarias. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Domingo (inclusive) de la semana lunes–domingo a la que pertenece el día civil. */
export function endOfWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return addDays(day, weekday === 0 ? 0 : 7 - weekday)
}

export type EventTiming = { starts_at: string; ends_at?: string | null }

/** ¿El evento ya terminó? Sin hora de fin se da por terminado 3 h después de empezar. */
export function isEventOver(ev: EventTiming, now: number): boolean {
  return eventEndMs(ev.starts_at, ev.ends_at) < now
}

/**
 * ¿El evento entra en la ventana? Un evento terminado no entra en ninguna.
 *  - hoy:      empieza hoy (día civil de su ciudad) o empezó antes y sigue en curso.
 *  - semana:   empieza entre hoy y el domingo de esta semana (o sigue en curso).
 *  - proximos: todo lo que no ha terminado.
 */
export function inEventWindow(
  ev: EventTiming,
  window: EventWindow,
  tz: string | null | undefined,
  now: number,
): boolean {
  if (Number.isNaN(new Date(ev.starts_at).getTime())) return false
  if (isEventOver(ev, now)) return false
  if (window === 'proximos') return true
  const today = localDay(now, tz)
  const day = localDay(ev.starts_at, tz)
  const limit = window === 'hoy' ? today : endOfWeek(today)
  return day <= limit // `day < today` solo ocurre si sigue en curso (los terminados ya salieron)
}

export type EventPhase = 'cancelled' | 'past' | 'live' | 'upcoming'

/** Estado que pinta la página del evento. */
export function eventPhase(ev: EventTiming & { status: string | null }, now: number): EventPhase {
  if (ev.status === 'cancelled') return 'cancelled'
  if (isEventOver(ev, now)) return 'past'
  return new Date(ev.starts_at).getTime() <= now ? 'live' : 'upcoming'
}

export const RSVP_STATUSES = ['going', 'interested'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]
