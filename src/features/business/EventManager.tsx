'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, Users, ChevronDown, Calendar, Pencil } from 'lucide-react'
import { cancelEvent, deleteEvent } from '@/actions/events'
import { boostEvent, endEventBoost } from '@/actions/boosts'
import { toast } from '@/shared/components/toast'
import { PhotoImg } from '@/shared/components/photo-img'
import { fmtInZone } from '@/lib/tz'
import { EventForm } from '@/features/business/EventForm'
import { cardClass, dangerBtn, ghostBtn, inputSm, linkBtn, sectionTitle } from '@/features/business/ui'

type Attendee = { name: string; status: string; when: string }
export type PanelEvent = {
  id: string
  name: string
  starts_at: string
  ends_at: string | null
  description: string | null
  image_url: string | null
  is_boosted: boolean | null
  status: string | null
  goingCount: number
  interestedCount: number
  attendees: Attendee[]
}

// Fechas SIEMPRE en la zona de la ciudad del lugar: servidor (UTC) y navegador dan el mismo
// texto → sin error de hidratación, y el dueño ve la hora que escribió.
const fmt = (s: string, tz: string | null) =>
  fmtInZone(s, tz, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDay = (s: string, tz: string | null) => fmtInZone(s, tz, { day: 'numeric', month: 'short' })
const badge = 'ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium'

function Attendees({ ev, timeZone }: { ev: PanelEvent; timeZone: string | null }) {
  const [open, setOpen] = useState(false)
  const total = ev.goingCount + ev.interestedCount
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={total === 0} aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-left text-xs transition enabled:hover:bg-surface disabled:cursor-default">
        <span className="inline-flex items-center gap-1.5 text-fg-soft">
          <Users size={13} strokeWidth={1.75} className="text-goospe-green" />
          {total === 0 ? 'Sin participaciones aún' : (
            <>
              <span className="font-medium text-fg">{ev.goingCount}</span> asistirán
              {ev.interestedCount > 0 && <span className="text-muted">· {ev.interestedCount} interesados</span>}
            </>
          )}
        </span>
        {total > 0 && <ChevronDown size={14} className={`text-muted transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && total > 0 && (
        <ul className="divide-y divide-line/60 border-t border-line bg-surface/50 px-3 py-1">
          {ev.attendees.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-fg">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-goospe-green/15 text-[10px] font-medium text-goospe-green-dark">{a.name.charAt(0).toUpperCase()}</span>
                <span className="truncate">{a.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${a.status === 'going' ? 'bg-goospe-green/15 text-goospe-green-dark' : 'bg-line text-muted'}`}>
                  {a.status === 'going' ? 'Asistirá' : 'Interesado'}
                </span>
                {fmtDay(a.when, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// Confirmación de cancelación con motivo opcional (se incluye en el aviso a los inscritos).
function CancelBox({ ev, placeId, onClose }: { ev: PanelEvent; placeId: string; onClose: (done: boolean) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function confirm() {
    const fd = new FormData()
    fd.set('event_id', ev.id); fd.set('place_id', placeId); fd.set('reason', reason)
    setBusy(true)
    const res = await cancelEvent(fd)
    setBusy(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success(ev.goingCount + ev.interestedCount > 0 ? 'Evento cancelado. Avisamos a los inscritos.' : 'Evento cancelado')
    onClose(true)
  }
  return (
    <div role="alertdialog" aria-label={`Cancelar ${ev.name}`} className="space-y-2 border-t border-line bg-red-500/5 p-3">
      <p className="text-sm text-fg">¿Cancelar este evento? Dejará de verse en Goospe y avisaremos a quienes se apuntaron.</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} aria-label="Motivo de la cancelación (opcional)"
        placeholder="Motivo (opcional): se muestra a los inscritos" className={inputSm} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={busy} className={dangerBtn}>{busy ? 'Cancelando…' : 'Sí, cancelar evento'}</button>
        <button type="button" onClick={() => onClose(false)} disabled={busy} className={ghostBtn}>Volver</button>
      </div>
    </div>
  )
}

// Sin hora de término, un evento se da por terminado 3 h después de empezar (como en el feed).
const FALLBACK_DURATION_MS = 3 * 3600_000
const isFinished = (ev: PanelEvent, now: number) =>
  (ev.ends_at ? new Date(ev.ends_at).getTime() : new Date(ev.starts_at).getTime() + FALLBACK_DURATION_MS) < now

function EventRow({ ev, placeId, timeZone, finished, onEdit }: {
  ev: PanelEvent; placeId: string; timeZone: string | null; finished: boolean; onEdit: () => void
}) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const cancelled = ev.status === 'cancelled'
  const closed = cancelled || finished // ya no admite editar, destacar ni cancelar

  async function onDelete() {
    if (!window.confirm('¿Eliminar este evento? No se puede deshacer.')) return
    const fd = new FormData()
    fd.set('event_id', ev.id); fd.set('place_id', placeId)
    const res = await deleteEvent(fd)
    if (res?.error) { toast.error(res.error); return }
    toast.success('Evento eliminado')
    router.refresh()
  }

  async function onToggleBoost() {
    const fd = new FormData()
    fd.set('event_id', ev.id)
    const res = ev.is_boosted ? await endEventBoost(fd) : await boostEvent(fd)
    if (res?.error) { toast.error(res.error); return }
    toast.success(ev.is_boosted ? 'Ya no está destacado' : 'Evento destacado')
    router.refresh()
  }

  return (
    <li className={`overflow-hidden rounded-lg border border-line ${closed ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2">
        {ev.image_url && <PhotoImg src={ev.image_url} alt={ev.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" isoClassName="h-5 w-5" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg [overflow-wrap:anywhere]">
            <span className={cancelled ? 'line-through' : ''}>{ev.name}</span>
            {cancelled && <span className={`${badge} bg-line text-fg-soft`}>Cancelado</span>}
            {!cancelled && finished && <span className={`${badge} bg-line text-fg-soft`}>Finalizado</span>}
            {!closed && ev.is_boosted && <span className={`${badge} bg-goospe-green/15 text-goospe-green-dark`}><Sparkles size={10} strokeWidth={2} /> Destacado</span>}
          </p>
          <p className="flex items-center gap-1 text-xs text-goospe-green"><Calendar size={11} strokeWidth={1.75} /> {fmt(ev.starts_at, timeZone)}</p>
        </div>
      </div>

      {/* Acciones en su propia fila: a 390 px no caben junto al nombre. */}
      <div className="flex flex-wrap items-center gap-x-4 border-t border-line px-3">
        {!closed && (
          <>
            <button type="button" onClick={onEdit} className={`min-h-11 ${linkBtn}`}><Pencil size={13} strokeWidth={1.75} /> Editar</button>
            <button type="button" onClick={onToggleBoost} className={`min-h-11 ${linkBtn}`}>
              {ev.is_boosted ? 'Quitar destacado' : <><Sparkles size={14} strokeWidth={1.75} /> Destacar</>}
            </button>
            <button type="button" onClick={() => setCancelling(true)} className="min-h-11 text-sm text-fg-soft hover:underline">Cancelar evento</button>
          </>
        )}
        <button type="button" onClick={onDelete} className="ml-auto min-h-11 text-sm text-red-600 hover:underline dark:text-red-400">Eliminar</button>
      </div>

      {cancelling && <CancelBox ev={ev} placeId={placeId} onClose={(done) => { setCancelling(false); if (done) router.refresh() }} />}
      <Attendees ev={ev} timeZone={timeZone} />
    </li>
  )
}

/** Eventos del lugar: crear, editar, cancelar (avisando a los inscritos), destacar y eliminar. */
export function EventManager({ placeId, events, timeZone, cityName, now }: {
  placeId: string; events: PanelEvent[]; timeZone: string | null; cityName?: string | null
  /** "Ahora" del servidor (ms): decide qué eventos ya terminaron sin desfase de hidratación. */
  now: number
}) {
  const router = useRouter()
  // 'new' = formulario de alta · id = edición de ese evento · null = cerrado
  const [editing, setEditing] = useState<string | null>(null)
  const done = (message: string) => { setEditing(null); toast.success(message); router.refresh() }
  const current = events.find((e) => e.id === editing)

  return (
    <section id="eventos" className={`scroll-mt-32 ${cardClass}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={sectionTitle}>Eventos</h2>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')} className={`min-h-11 ${linkBtn}`}><Plus size={15} strokeWidth={2} /> Nuevo evento</button>
        )}
      </div>

      {editing === 'new' && (
        <EventForm placeId={placeId} timeZone={timeZone} cityName={cityName} onDone={done} onCancel={() => setEditing(null)} />
      )}
      {current && (
        <EventForm key={current.id} placeId={placeId} timeZone={timeZone} cityName={cityName} event={current} onDone={done} onCancel={() => setEditing(null)} />
      )}

      {events.length === 0 ? (
        <p className="text-sm text-muted">Aún no tienes eventos.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} placeId={placeId} timeZone={timeZone} finished={isFinished(ev, now)} onEdit={() => setEditing(ev.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}
