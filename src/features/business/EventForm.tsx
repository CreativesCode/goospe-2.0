'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, ImagePlus, X } from 'lucide-react'
import { createEvent, updateEvent } from '@/actions/events'
import { generatePromo } from '@/actions/ai-assist'
import { isoToLocalInZone, nowLocalInZone } from '@/lib/tz'
import { RESIZE_PRESETS, resizeImage } from '@/lib/image-resize'
import { ghostBtn, inputSm as inp, primaryBtn } from '@/features/business/ui'

export type EditableEvent = {
  id: string
  name: string
  description: string | null
  starts_at: string
  ends_at: string | null
  image_url: string | null
}

/**
 * Formulario de evento: crea uno nuevo o edita `event`. Las horas se escriben y se leen en la
 * zona horaria de la ciudad del lugar (cities.timezone), esté donde esté el dueño o el servidor.
 */
export function EventForm({ placeId, timeZone, cityName, event, onDone, onCancel }: {
  placeId: string
  timeZone: string | null
  cityName?: string | null
  event?: EditableEvent
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const editing = !!event
  // false = en reposo · 'image' = optimizando la imagen en el navegador · 'send' = guardando
  const [saving, setSaving] = useState<false | 'image' | 'send'>(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [name, setName] = useState(event?.name ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [brief, setBrief] = useState('')
  const [genning, setGenning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [minStart, setMinStart] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)

  // Evita mismatch de hidratación: el mínimo del datepicker se fija en el cliente.
  // Es "ahora" en la zona del lugar, no en la del navegador. Al editar no hay mínimo
  // (el evento puede haber empezado ya).
  useEffect(() => { if (!editing) setMinStart(nowLocalInZone(timeZone)) }, [timeZone, editing])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPreview(file ? URL.createObjectURL(file) : null)
  }
  function clearImage() {
    if (fileRef.current) fileRef.current.value = ''
    setPreview(null)
  }

  async function onGenerate() {
    setGenning(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('brief', brief)
    const res = await generatePromo(fd)
    setGenning(false)
    if (!res || 'error' in res) { setMsg(res?.error ?? 'Error'); return }
    if (res.title) setName(res.title)
    if (res.description) setDescription(res.description)
  }

  // Se envía con onSubmit (no con `<form action>`): React reinicia los campos no controlados
  // al terminar una acción, así que tras un error del servidor se perdían fechas e imagen.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setMsg(null)
    // La imagen se reduce en el navegador antes de enviarla (si falla, viaja el original y el
    // servidor decide).
    const image = formData.get('image')
    if (image instanceof File && image.size > 0) {
      setSaving('image')
      const out = await resizeImage(image, RESIZE_PRESETS.photo)
      formData.set('image', out.file, out.file.name)
    }
    setSaving('send')
    const res = editing ? await updateEvent(formData) : await createEvent(formData)
    setSaving(false)
    if (res?.error) { setMsg(res.error); return }
    onDone(editing ? 'Evento actualizado' : 'Evento creado y publicado')
  }

  const shownImage = preview ?? event?.image_url ?? null
  return (
    <form onSubmit={onSubmit} className="mb-5 space-y-4 rounded-xl bg-surface p-4">
      <input type="hidden" name="place_id" value={placeId} />
      {event && <input type="hidden" name="event_id" value={event.id} />}

      {/* Asistente Decídeme: redacta el evento a partir de una idea corta. */}
      <div className="space-y-1.5 rounded-lg bg-goospe-green/5 p-2">
        <p className="flex items-center gap-1 px-1 text-xs font-medium text-goospe-green-dark">
          <Sparkles size={12} strokeWidth={2} /> Asistente Decídeme · te redacta el evento
        </p>
        <div className="flex gap-2">
          <input value={brief} onChange={(e) => setBrief(e.target.value)} aria-label="Idea del evento"
            placeholder="Cuéntale la idea (ej: noche de jazz el viernes)" className={inp} />
          <button type="button" onClick={onGenerate} disabled={genning}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-goospe-gradient px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            {genning ? '…' : <><Sparkles size={15} strokeWidth={1.75} /> Generar</>}
          </button>
        </div>
      </div>

      <label className="block text-xs font-medium text-fg-soft">Nombre del evento
        <input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Noche de jazz en vivo" className={`mt-1 ${inp}`} />
      </label>

      {/* Imagen del evento con preview */}
      <div className="text-xs font-medium text-fg-soft">
        Imagen (opcional)
        <div className="mt-1 flex items-center gap-3">
          {shownImage && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownImage} alt="Vista previa" className="h-20 w-20 rounded-lg object-cover" />
              {preview && (
                <button type="button" onClick={clearImage} aria-label="Quitar imagen nueva"
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow">
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm font-normal text-fg-soft transition hover:border-goospe-green hover:text-goospe-green ${preview ? 'hidden' : ''}`}>
            <ImagePlus size={16} strokeWidth={1.75} /> {event?.image_url ? 'Cambiar imagen' : 'Subir imagen'}
            <input ref={fileRef} type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-fg-soft">Inicio
          <input name="starts_at" type="datetime-local" required min={minStart}
            defaultValue={event ? isoToLocalInZone(event.starts_at, timeZone) : undefined} className={`mt-1 ${inp}`} />
        </label>
        <label className="text-xs font-medium text-fg-soft">Fin (opcional)
          <input name="ends_at" type="datetime-local" min={minStart}
            defaultValue={event?.ends_at ? isoToLocalInZone(event.ends_at, timeZone) : undefined} className={`mt-1 ${inp}`} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-muted">
        Hora local {cityName ? `de ${cityName}` : 'del lugar'}.{editing ? ' Si cambias la fecha, avisamos a los inscritos.' : ''}
      </p>

      <label className="block text-xs font-medium text-fg-soft">Descripción (opcional)
        <textarea name="description" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Qué pueden esperar los asistentes?" className={`mt-1 ${inp}`} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!!saving} className={primaryBtn}>
          {saving === 'image' ? 'Optimizando imagen…' : saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}
        </button>
        <button type="button" onClick={onCancel} disabled={!!saving} className={ghostBtn}>Cancelar</button>
        {msg && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{msg}</span>}
      </div>
    </form>
  )
}
