'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

export type RegionJob = Database['public']['Tables']['region_jobs']['Row']

// Sigue un region_job en vivo: fetch inicial + suscripción Realtime a sus UPDATE.
export function useRegionJob(jobId: string | null): RegionJob | null {
  const [job, setJob] = useState<RegionJob | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      return
    }
    const supabase = createClient()
    let active = true

    supabase
      .from('region_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
      .then(({ data }) => {
        if (active && data) setJob(data as RegionJob)
      })

    const channel = supabase
      .channel(`region_job:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'region_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          if (active) setJob(payload.new as RegionJob)
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [jobId])

  return job
}
