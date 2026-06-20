// Reporter de progreso para region_jobs: mantiene el estado en memoria y lo vuelca a la BD
// en cada cambio (Supabase Realtime → el monitor admin lo recibe en vivo).

export async function getJob(sb, jobId) {
  const { data, error } = await sb.from('region_jobs').select('*').eq('id', jobId).single()
  if (error) throw new Error(`region_jobs ${jobId}: ${error.message}`)
  return data
}

const ts = () => new Date().toISOString().slice(11, 19)

export function makeReporter(sb, jobId) {
  const state = { status: 'running', stage: null, progress: 0, counts: {}, log: [], error: null }

  async function flush() {
    const { error } = await sb
      .from('region_jobs')
      .update({
        status: state.status,
        stage: state.stage,
        progress: state.progress,
        counts: state.counts,
        log: state.log,
        error: state.error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    if (error) console.error('job flush error:', error.message)
  }

  return {
    state,
    async stage(name, progress) {
      state.stage = name
      if (progress != null) state.progress = progress
      await flush()
    },
    async progress(p) {
      state.progress = Math.min(1, Math.max(0, p))
      await flush()
    },
    async counts(patch) {
      state.counts = { ...state.counts, ...patch }
      await flush()
    },
    async log(line) {
      state.log.push(`[${ts()}] ${line}`)
      if (state.log.length > 250) state.log = state.log.slice(-250)
      console.log(line)
      await flush()
    },
    async done() {
      state.status = 'done'
      state.stage = 'done'
      state.progress = 1
      await flush()
    },
    async fail(msg) {
      state.status = 'error'
      state.error = String(msg)
      await flush()
    },
  }
}
