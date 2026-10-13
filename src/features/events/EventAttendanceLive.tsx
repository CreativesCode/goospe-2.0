'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AttendanceCounts } from './AttendanceCounts'
import { RSVP_CHANGED } from './use-rsvp'

type Stats = { going: number; male: number; female: number; interested: number }
const EMPTY: Stats = { going: 0, male: 0, female: 0, interested: 0 }

/**
 * Versión cliente del conteo de asistentes: consulta el RPC agregado `event_gender_stats`
 * (solo conteos) para su evento. Pensada para el feed (100% cliente) y la página del evento
 * (ISR): se vuelve a consultar cuando el usuario cambia su respuesta. Si el RPC falla, no
 * muestra nada (degrada en silencio).
 */
export function EventAttendanceLive({ eventId, className }: { eventId: string; className?: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let alive = true
    const sb = createClient()
    // El cliente del navegador no tipa los RPC → cast al estilo del resto del repo.
    const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
    const load = async () => {
      const { data, error } = await rpc('event_gender_stats', { p_event_ids: [eventId] })
      if (!alive) return
      if (error) { setStats(null); return }
      const row = (data as Partial<Stats>[] | null)?.[0]
      setStats(row
        ? {
            going: Number(row.going) || 0,
            male: Number(row.male) || 0,
            female: Number(row.female) || 0,
            interested: Number(row.interested) || 0, // la columna llega con la migración 0041
          }
        : EMPTY)
    }
    const onChange = (e: Event) => {
      if ((e as CustomEvent<{ eventId?: string }>).detail?.eventId === eventId) void load()
    }
    void load()
    window.addEventListener(RSVP_CHANGED, onChange)
    return () => { alive = false; window.removeEventListener(RSVP_CHANGED, onChange) }
  }, [eventId])

  if (!stats) return null
  return <AttendanceCounts {...stats} className={className} />
}
