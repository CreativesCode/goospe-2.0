'use client'

import { useCallback, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { IMAGE_MAX_BYTES } from '@/lib/image-sniff'
import { formatBytes, resizeImage, type ResizePreset } from '@/lib/image-resize'

// Estado visible, archivo por archivo, de una subida de imágenes: se optimiza en el navegador
// (src/lib/image-resize.ts) y después se envía a la server action. Las server actions no
// informan el avance en bytes, así que el progreso es por etapas.
export type UploadPhase = 'optimizing' | 'uploading' | 'done' | 'error'
export type UploadItem = {
  id: string
  name: string
  phase: UploadPhase
  originalBytes: number
  /** Peso de lo que se envía, una vez optimizada. */
  finalBytes?: number
  error?: string
}
export type Prepared = { id: string; file: File }
type SendResult = { error?: string } | undefined | void

const TOO_BIG = `La imagen supera los ${Math.round(IMAGE_MAX_BYTES / (1024 * 1024))} MB incluso optimizada. Prueba con otra.`
const NOT_IMAGE = 'Formato no soportado (usa JPG, PNG o WebP)'
const NETWORK = 'No pudimos subir la imagen. Revisa tu conexión.'
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function useImageUploads() {
  const [items, setItems] = useState<UploadItem[]>([])
  const seq = useRef(0)

  const patch = useCallback((ids: string[], change: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, ...change } : it)))
  }, [])

  /**
   * Optimiza cada archivo (uno a la vez: el canvas de una foto grande usa mucha memoria) y
   * devuelve los que quedaron listos, ya en fase "Subiendo…". Los que no sirven quedan en error.
   */
  const prepare = useCallback(async (files: File[], preset: ResizePreset, maxBytes: number = IMAGE_MAX_BYTES): Promise<Prepared[]> => {
    const batch = files.map((f) => ({ id: `u${++seq.current}`, file: f }))
    setItems(batch.map(({ id, file }) => ({ id, name: file.name, phase: 'optimizing', originalBytes: file.size })))
    const ready: Prepared[] = []
    for (const { id, file } of batch) {
      if (!ACCEPTED.has(file.type)) { patch([id], { phase: 'error', error: NOT_IMAGE }); continue }
      const out = await resizeImage(file, preset)
      if (out.file.size > maxBytes) { patch([id], { phase: 'error', error: TOO_BIG, finalBytes: out.file.size }); continue }
      patch([id], { phase: 'uploading', finalBytes: out.file.size })
      ready.push({ id, file: out.file })
    }
    return ready
  }, [patch])

  /** Optimiza y sube de a un archivo. Devuelve cuántos se subieron bien. */
  const uploadEach = useCallback(async (files: File[], preset: ResizePreset, send: (file: File) => Promise<SendResult>): Promise<number> => {
    const ready = await prepare(files, preset)
    let ok = 0
    for (const { id, file } of ready) {
      const res = await send(file).catch(() => ({ error: NETWORK }))
      if (res?.error) patch([id], { phase: 'error', error: res.error })
      else { patch([id], { phase: 'done' }); ok++ }
    }
    return ok
  }, [prepare, patch])

  const finish = useCallback((ids: string[], error?: string) => {
    patch(ids, error ? { phase: 'error', error } : { phase: 'done' })
  }, [patch])

  const busy = items.some((it) => it.phase === 'optimizing' || it.phase === 'uploading')
  return { items, busy, prepare, uploadEach, finish, clear: () => setItems([]) }
}

const STEP: Record<UploadPhase, string> = { optimizing: 'w-1/3', uploading: 'w-3/4', done: 'w-full', error: 'w-full' }

/**
 * Lista de archivos con su etapa ("Optimizando…", "Subiendo…", listo o el error).
 * `uploadingLabel`: texto de la etapa de envío cuando el servidor hace algo más que guardar.
 */
export function UploadStatusList({ items, uploadingLabel = 'Subiendo…', className = '' }: {
  items: UploadItem[]; uploadingLabel?: string; className?: string
}) {
  if (!items.length) return null
  return (
    <ul role="status" aria-live="polite" className={`space-y-2 ${className}`}>
      {items.map((it) => {
        const failed = it.phase === 'error'
        const working = it.phase === 'optimizing' || it.phase === 'uploading'
        const saved = it.finalBytes !== undefined && it.finalBytes < it.originalBytes
        return (
          <li key={it.id} className={`rounded-lg border px-3 py-2 text-xs ${failed ? 'border-red-500/40 bg-red-500/5' : 'border-line bg-surface'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-fg">{it.name}</span>
              <span className={`inline-flex shrink-0 items-center gap-1 font-medium ${failed ? 'text-red-600 dark:text-red-400' : it.phase === 'done' ? 'text-ink' : 'text-fg-soft'}`}>
                {working && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
                {it.phase === 'done' && <CheckCircle2 size={13} strokeWidth={2} />}
                {failed && <AlertTriangle size={13} strokeWidth={2} />}
                {it.phase === 'optimizing' ? 'Optimizando…' : it.phase === 'uploading' ? uploadingLabel : it.phase === 'done' ? 'Lista' : 'No se subió'}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className={`h-full rounded-full transition-all duration-300 ${STEP[it.phase]} ${failed ? 'bg-red-500' : 'bg-goospe-green'} ${working ? 'animate-pulse' : ''}`} />
            </div>
            {failed
              ? <p role="alert" className="mt-1 text-red-600 dark:text-red-400">{it.error}</p>
              : it.finalBytes !== undefined && (
                <p className="mt-1 text-muted">
                  {saved ? `${formatBytes(it.originalBytes)} → ${formatBytes(it.finalBytes)}` : formatBytes(it.finalBytes)}
                </p>
              )}
          </li>
        )
      })}
    </ul>
  )
}
