'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus } from 'lucide-react'
import { createEvent, deleteEvent } from '@/actions/events'
import { generatePromo } from '@/actions/ai-assist'
import { boostEvent, endEventBoost } from '@/actions/boosts'

type Ev = { id: string; name: string; starts_at: string; description: string | null; is_boosted: boolean | null }

const fmt = (s: string) =>
  new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const inp = 'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green'

export function EventManager({ placeId, events }: { placeId: string; events: Ev[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [brief, setBrief] = useState('')
  const [genning, setGenning] = useState(false)

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
    else { setMsg(null); setOpen(false); setName(''); setDescription(''); setBrief(''); router.refresh() }
  }

  async function onDelete(id: string) {
    const fd = new FormData()
    fd.set('event_id', id)
    fd.set('place_id', placeId)
    await deleteEvent(fd)
    router.refresh()
  }

  async function onToggleBoost(ev: Ev) {
    const fd = new FormData()
    fd.set('event_id', ev.id)
    const res = ev.is_boosted ? await endEventBoost(fd) : await boostEvent(fd)
    if (res?.error) { alert(res.error); return }
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-fg">Eventos</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-goospe-green hover:underline">
          {open ? 'Cancelar' : <><Plus size={15} strokeWidth={2} /> Nuevo evento</>}
        </button>
      </div>

      {open && (
        <form action={onCreate} className="mb-5 space-y-3 rounded-xl bg-surface p-4">
          <input type="hidden" name="place_id" value={placeId} />

          {/* asistente IA */}
          <div className="flex gap-2 rounded-lg bg-goospe-green/5 p-2">
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Idea para la IA (ej: noche de jazz el viernes)"
              className={inp}
            />
            <button type="button" onClick={onGenerate} disabled={genning}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-goospe-gradient px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {genning ? '…' : <><Sparkles size={15} strokeWidth={1.75} /> Generar</>}
            </button>
          </div>

          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del evento" className={inp} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-fg-soft">Inicio
              <input name="starts_at" type="datetime-local" required className={`mt-1 ${inp}`} />
            </label>
            <label className="text-xs text-fg-soft">Fin (opcional)
              <input name="ends_at" type="datetime-local" className={`mt-1 ${inp}`} />
            </label>
          </div>
          <textarea name="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" className={inp} />
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
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {ev.name}{ev.is_boosted && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark"><Sparkles size={10} strokeWidth={2} /> Destacado</span>}
                </p>
                <p className="text-xs text-goospe-green">{fmt(ev.starts_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => onToggleBoost(ev)} className="inline-flex items-center gap-1 text-sm font-medium text-goospe-green hover:underline">
                  {ev.is_boosted ? 'Quitar' : <><Sparkles size={14} strokeWidth={1.75} /> Destacar</>}
                </button>
                <button onClick={() => onDelete(ev.id)} className="text-sm text-red-600 hover:underline">Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
