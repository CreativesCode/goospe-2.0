import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import { isAuthorizedCron } from '@/lib/cron/auth'

// Rastro de las tareas programadas (tabla job_runs): una fila al empezar, que se cierra con el
// resultado. Así una ejecución que murió a mitad se ve (finished_at nulo) en vez de no existir.

export type JobCounts = Record<string, Json>
export type JobResult = { job: string; ok: boolean; counts: JobCounts; error?: string }

/** Ejecuta una tarea dejando su rastro. Nunca lanza: el error vuelve en el resultado. */
export async function withJobRun(job: string, fn: () => Promise<JobCounts>): Promise<JobResult> {
  const admin = createAdminClient()
  const { data, error: startErr } = await admin.from('job_runs').insert({ job }).select('id').single()
  if (startErr) console.error(`[cron:${job}] sin rastro:`, startErr.message)
  const runId = data?.id ?? null

  let result: JobResult
  try {
    result = { job, ok: true, counts: await fn() }
  } catch (e) {
    const message = (e as Error).message
    console.error(`[cron:${job}]`, message)
    result = { job, ok: false, counts: {}, error: message.slice(0, 1000) }
  }

  if (runId !== null) {
    const { error } = await admin.from('job_runs')
      .update({ finished_at: new Date().toISOString(), ok: result.ok, counts: result.counts, error: result.error ?? null })
      .eq('id', runId)
    if (error) console.error(`[cron:${job}] no se pudo cerrar el rastro:`, error.message)
  }
  return result
}

/**
 * Cuerpo común de una ruta de cron: valida el secreto y responde un resumen JSON pequeño.
 * 401 sin secreto válido; 500 si alguna tarea falló (para que Vercel lo marque en rojo).
 */
export async function runCronRoute(request: Request, run: () => Promise<JobResult[]>): Promise<NextResponse> {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const jobs = await run()
  const ok = jobs.every((j) => j.ok)
  return NextResponse.json({ ok, jobs }, { status: ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } })
}
