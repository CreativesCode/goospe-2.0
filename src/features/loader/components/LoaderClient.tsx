'use client'

import { useState } from 'react'
import { ZonePicker } from './ZonePicker'
import { JobMonitor } from './JobMonitor'

export function LoaderClient() {
  const [jobId, setJobId] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <ZonePicker onStarted={setJobId} />
      {jobId && <JobMonitor jobId={jobId} />}
      {jobId && (
        <button onClick={() => setJobId(null)} className="text-sm text-fg-soft underline hover:text-fg">
          ← Cargar otra zona
        </button>
      )}
    </div>
  )
}
