'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, deleteEvent } from '@/actions/events'

type Ev = { id: string; name: string; starts_at: string; description: string | null }

const fmt = (s: string) =>
  new Date(s).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function EventManager({ placeId, events }: { placeId: string; events: Ev[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function onCreate(formData: FormData) {
    setSaving(true); setMsg(null)
    const res = await createEvent(formData)
    setSaving(false)
    if (res?.error) setMsg(res.error)
    else { setMsg(null); setOpen(false); router.refresh() }
  }

  async function onDelete(id: string) {
    const fd = new FormData()
    fd.set('event_id', id)
    fd.set('place_id', placeId)
    await deleteEvent(fd)
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-goospe-gray">Eventos</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-goospe-green hover:underline">
          {open ? 'Cancelar' : '+ Nuevo evento'}
        </button>
      </div>

      {open && (
        <form action={onCreate} className="mb-5 space-y-3 rounded-xl bg-gray-50 p-4">
          <input type="hidden" name="place_id" value={placeId} />
          <input name="name" required placeholder="Nombre del evento"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-goospe-green" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-goospe-gray/60">Inicio
              <input name="starts_at" type="datetime-local" required
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-goospe-green" />
            </label>
            <label className="text-xs text-goospe-gray/60">Fin (opcional)
              <input name="ends_at" type="datetime-local"
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-goospe-green" />
            </label>
          </div>
          <textarea name="description" rows={2} placeholder="Descripción (opcional)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-goospe-green" />
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
        <p className="text-sm text-goospe-gray/50">Aún no tienes eventos.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-goospe-gray">{ev.name}</p>
                <p className="text-xs text-goospe-green">{fmt(ev.starts_at)}</p>
              </div>
              <button onClick={() => onDelete(ev.id)} className="shrink-0 text-sm text-red-600 hover:underline">Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
