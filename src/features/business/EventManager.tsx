'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, Users, ChevronDown, ImagePlus, X, Calendar } from 'lucide-react'
import { createEvent, deleteEvent } from '@/actions/events'
import { generatePromo } from '@/actions/ai-assist'
import { boostEvent, endEventBoost } from '@/actions/boosts'
import { toast } from '@/shared/components/toast'
import { PhotoImg } from '@/shared/components/photo-img'

type Attendee = { name: string; status: string; when: string }
type Ev = {
  id: string
  name: string
  starts_at: string
  ends_at: string | null
  description: string | null
  image_url: string | null
  is_boosted: boolean | null
  goingCount: number
  interestedCount: number
  attendees: Attendee[]
}

const fmt = (s: string) =>
  new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })

const inp = 'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green'

// Fecha/hora mínima para el input (ahora, en formato datetime-local local).
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function EventManager({ placeId, events }: { placeId: string; events: Ev[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [brief, setBrief] = useState('')
  const [genning, setGenning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [minStart, setMinStart] = useState<string | undefined>(undefined)
  const [expanded, setExpanded] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Evita mismatch de hidratación: el mínimo del datepicker se fija en el cliente.
  useEffect(() => { setMinStart(nowLocal()) }, [])

  function resetForm() {
    setName(''); setDescription(''); setBrief(''); setMsg(null)
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    if (fileRef.current) fileRef.current.value = ''
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : null })
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

  async function onCreate(formData: FormData) {
    setSaving(true); setMsg(null)
    const res = await createEvent(formData)
    setSaving(false)
    if (res?.error) setMsg(res.error)
    else { setOpen(false); resetForm(); toast.success('Evento creado y publicado'); router.refresh() }
  }

  async function onDelete(id: string) {
    if (!window.confirm('¿Eliminar este evento? No se puede deshacer.')) return
    const fd = new FormData()
    fd.set('event_id', id)
    fd.set('place_id', placeId)
    const res = await deleteEvent(fd)
    if (res?.error) { toast.error(res.error); return }
    toast.success('Evento eliminado')
    router.refresh()
  }

  async function onToggleBoost(ev: Ev) {
    const fd = new FormData()
    fd.set('event_id', ev.id)
    const res = ev.is_boosted ? await endEventBoost(fd) : await boostEvent(fd)
    if (res?.error) { toast.error(res.error); return }
    toast.success(ev.is_boosted ? 'Ya no está destacado' : 'Evento destacado')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-fg">Eventos</h2>
        <button onClick={() => { setOpen((v) => !v); if (open) resetForm() }} className="inline-flex items-center gap-1 text-sm font-medium text-goospe-green hover:underline">
          {open ? 'Cancelar' : <><Plus size={15} strokeWidth={2} /> Nuevo evento</>}
        </button>
      </div>

      {open && (
        <form action={onCreate} className="mb-5 space-y-4 rounded-xl bg-surface p-4">
          <input type="hidden" name="place_id" value={placeId} />

          {/* Asistente Decídeme: redacta el evento a partir de una idea corta. */}
          <div className="space-y-1.5 rounded-lg bg-goospe-green/5 p-2">
            <p className="flex items-center gap-1 px-1 text-xs font-medium text-goospe-green-dark">
              <Sparkles size={12} strokeWidth={2} /> Asistente Decídeme · te redacta el evento
            </p>
            <div className="flex gap-2">
              <input
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Cuéntale la idea (ej: noche de jazz el viernes)"
                className={inp}
              />
              <button type="button" onClick={onGenerate} disabled={genning}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-goospe-gradient px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                {genning ? '…' : <><Sparkles size={15} strokeWidth={1.75} /> Generar</>}
              </button>
            </div>
          </div>

          <label className="block text-xs font-medium text-fg-soft">Nombre del evento
            <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Noche de jazz en vivo" className={`mt-1 ${inp}`} />
          </label>

          {/* Imagen del evento con preview */}
          <div className="text-xs font-medium text-fg-soft">
            Imagen (opcional)
            <div className="mt-1 flex items-center gap-3">
              {preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Vista previa" className="h-20 w-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => { if (fileRef.current) fileRef.current.value = ''; setPreview((p) => { if (p) URL.revokeObjectURL(p); return null }) }}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow">
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm font-normal text-fg-soft transition hover:border-goospe-green hover:text-goospe-green">
                  <ImagePlus size={16} strokeWidth={1.75} /> Subir imagen
                  <input ref={fileRef} type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-fg-soft">Inicio
              <input name="starts_at" type="datetime-local" required min={minStart} className={`mt-1 ${inp}`} />
            </label>
            <label className="text-xs font-medium text-fg-soft">Fin (opcional)
              <input name="ends_at" type="datetime-local" min={minStart} className={`mt-1 ${inp}`} />
            </label>
          </div>

          <label className="block text-xs font-medium text-fg-soft">Descripción (opcional)
            <textarea name="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Qué pueden esperar los asistentes?" className={`mt-1 ${inp}`} />
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-60">
              {saving ? 'Creando…' : 'Crear evento'}
            </button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-muted">Aún no tienes eventos.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const isOpen = expanded === ev.id
            const total = ev.goingCount + ev.interestedCount
            return (
              <li key={ev.id} className="rounded-lg border border-line">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    {ev.image_url && (
                      <PhotoImg src={ev.image_url} alt={ev.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" isoClassName="h-5 w-5" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {ev.name}{ev.is_boosted && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark"><Sparkles size={10} strokeWidth={2} /> Destacado</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-goospe-green"><Calendar size={11} strokeWidth={1.75} /> {fmt(ev.starts_at)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={() => onToggleBoost(ev)} className="inline-flex items-center gap-1 text-sm font-medium text-goospe-green hover:underline">
                      {ev.is_boosted ? 'Quitar' : <><Sparkles size={14} strokeWidth={1.75} /> Destacar</>}
                    </button>
                    <button onClick={() => onDelete(ev.id)} className="text-sm text-red-600 hover:underline">Eliminar</button>
                  </div>
                </div>

                {/* Barra de participaciones: conteo + toggle de asistentes */}
                <button
                  onClick={() => setExpanded(isOpen ? null : ev.id)}
                  disabled={total === 0}
                  className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-left text-xs transition enabled:hover:bg-surface disabled:cursor-default"
                >
                  <span className="inline-flex items-center gap-1.5 text-fg-soft">
                    <Users size={13} strokeWidth={1.75} className="text-goospe-green" />
                    {total === 0 ? (
                      'Sin participaciones aún'
                    ) : (
                      <>
                        <span className="font-medium text-fg">{ev.goingCount}</span> asistirán
                        {ev.interestedCount > 0 && <span className="text-muted">· {ev.interestedCount} interesados</span>}
                      </>
                    )}
                  </span>
                  {total > 0 && <ChevronDown size={14} className={`text-muted transition ${isOpen ? 'rotate-180' : ''}`} />}
                </button>

                {isOpen && total > 0 && (
                  <ul className="divide-y divide-line/60 border-t border-line bg-surface/50 px-3 py-1">
                    {ev.attendees.map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-fg">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-goospe-green/15 text-[10px] font-medium text-goospe-green-dark">
                            {a.name.charAt(0).toUpperCase()}
                          </span>
                          {a.name}
                        </span>
                        <span className="flex items-center gap-2 text-muted">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${a.status === 'going' ? 'bg-goospe-green/15 text-goospe-green-dark' : 'bg-line text-muted'}`}>
                            {a.status === 'going' ? 'Asistirá' : 'Interesado'}
                          </span>
                          {fmtDay(a.when)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
