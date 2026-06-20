'use client'

import { useRegionJob } from '../hooks/useRegionJob'

const STAGE_LABEL: Record<string, string> = {
  insert: 'Creando ciudad',
  osm: 'Importando OSM',
  dedupe: 'Deduplicando',
  photos: 'Fotos',
  enrich_anchors: 'Enriquecimiento IA (anclas)',
  enrich_tail: 'Enriquecimiento (cola)',
  activate: 'Activando ciudad',
  done: 'Completado',
}

const COUNT_LABEL: Record<string, string> = {
  osm: 'OSM', inserted: 'insertados', reasignados: 'reasignados', photos_google: 'fotos Google',
  enriched: 'enriquecidos', tail: 'cola larga', photos_mapillary: 'fotos Mapillary',
}

// Qué significa cada métrica (leyenda + tooltip nativo en cada chip).
const COUNT_HELP: Record<string, string> = {
  osm: 'Puntos de interés (restaurantes, cafés, bares…) encontrados en OpenStreetMap dentro de la zona.',
  inserted: 'Lugares nuevos guardados en la base de datos en esta carga.',
  reasignados: 'Lugares vecinos que ya existían y se movieron a esta zona por quedarle más cerca (corrige el solape entre comunas).',
  enriched: 'Lugares "ancla" a los que la IA les escribió descripción + frase de ambiente + embedding de búsqueda. Tope por zona (ZONE_ANCHOR_LIMIT, 60) para controlar el costo.',
  tail: 'Insertados que AÚN no se enriquecen con IA. Existen y se ven en el feed con sus datos básicos; el texto IA se generará on-demand más adelante. Por eso enriquecidos + cola larga = insertados.',
  photos_google: 'Fotos traídas de Google Places para mostrar (no se almacenan).',
  photos_mapillary: 'Fachadas de Mapillary descargadas para lugares sin foto (quedan pendientes de moderación).',
}

// Monitor en vivo de un job de carga (barra de progreso + etapa + counts + log vía Realtime).
export function JobMonitor({ jobId }: { jobId: string }) {
  const job = useRegionJob(jobId)
  if (!job) return <p className="text-sm text-muted">Conectando con el job…</p>

  const pct = Math.round((Number(job.progress) || 0) * 100)
  const counts = (job.counts ?? {}) as Record<string, number>
  const log = (Array.isArray(job.log) ? job.log : []) as string[]
  const isError = job.status === 'error'
  const isDone = job.status === 'done'

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-fg">{job.city_name}</div>
          <div className="text-xs text-muted">{[job.region, job.country].filter(Boolean).join(', ')}</div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isError ? 'bg-red-500/15 text-red-600'
            : isDone ? 'bg-goospe-green/15 text-goospe-green-dark'
            : 'bg-amber-400/20 text-amber-700'
          }`}
        >
          {isError ? 'Error' : isDone ? 'Listo' : STAGE_LABEL[job.stage ?? ''] ?? 'En curso'}
        </span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isError ? 'bg-red-500' : 'bg-goospe-gradient'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs text-muted">{pct}%</div>

      {Object.keys(counts).length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, v]) => (
              <span
                key={k}
                title={COUNT_HELP[k] ?? ''}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs text-fg-soft ring-1 ring-line"
              >
                {COUNT_LABEL[k] ?? k}: <span className="font-medium text-fg">{v}</span>
                {COUNT_HELP[k] && (
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-line text-[9px] font-bold text-muted" aria-hidden>
                    ?
                  </span>
                )}
              </span>
            ))}
          </div>

          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer select-none hover:text-fg-soft">¿Qué significa cada número?</summary>
            <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
              {Object.entries(COUNT_HELP)
                .filter(([k]) => k in counts)
                .map(([k, help]) => (
                  <li key={k}>
                    <span className="font-medium text-fg-soft">{COUNT_LABEL[k] ?? k}:</span> {help}
                  </li>
                ))}
            </ul>
          </details>
        </>
      )}

      {isError && job.error && <p className="mt-3 text-sm text-red-600">{job.error}</p>}

      {log.length > 0 && (
        <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-surface p-3 text-xs leading-relaxed text-fg-soft ring-1 ring-line">
          {log.join('\n')}
        </pre>
      )}
    </div>
  )
}
