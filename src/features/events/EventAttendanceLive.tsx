'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AttendanceCounts } from './AttendanceCounts'

type Stats = { going: number; male: number; female: number }

/**
 * Versión cliente del conteo de asistentes: consulta el RPC agregado `event_gender_stats`
 * (solo conteos) para su evento. Pensada para el feed, que es 100% cliente. Si el RPC aún no
 * existe o falla, no muestra nada (degrada en silencio).
 */
export function EventAttendanceLive({ eventId, className }: { eventId: string; className?: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let alive = true
    const sb = createClient()
    // rpc no está en los tipos generados → cast al estilo del resto del repo.
    const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
    rpc('event_gender_stats', { p_event_ids: [eventId] })
      .then(({ data }) => {
        if (!alive) return
        const row = (data as { going: number; male: number; female: number }[] | null)?.[0]
        setStats(row
          ? { going: Number(row.going), male: Number(row.male), female: Number(row.female) }
          : { going: 0, male: 0, female: 0 })
      })
      .catch(() => { if (alive) setStats(null) })
    return () => { alive = false }
  }, [eventId])

  if (!stats) return null
  return <AttendanceCounts going={stats.going} male={stats.male} female={stats.female} className={className} />
}
