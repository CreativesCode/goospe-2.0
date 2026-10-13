'use client'

import { Check, Star } from 'lucide-react'
import { useRsvp } from './use-rsvp'

const base = 'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition disabled:opacity-60'
const idle = 'border border-goospe-green/40 text-goospe-green-dark hover:bg-goospe-green/10'
const active = 'border border-goospe-green bg-goospe-green text-white'

/**
 * Respuesta a un evento con dos opciones separadas: "Me interesa" y "Asistiré". Solo
 * "Asistiré" suma al conteo público de asistentes. `size="lg"` es el de la página del evento.
 */
export function RsvpButton({ eventId, size = 'sm' }: { eventId: string; size?: 'sm' | 'lg' }) {
  const { status, busy, ready, choose } = useRsvp(eventId)
  const pad = size === 'lg' ? 'min-h-11 px-5 py-2.5 text-sm' : 'px-3 py-1.5 text-xs sm:text-sm'
  const icon = size === 'lg' ? 17 : 14
  return (
    <div role="group" aria-label="Tu respuesta al evento" aria-busy={busy} className="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        onClick={() => choose('interested')}
        disabled={busy || !ready}
        aria-pressed={status === 'interested'}
        className={`${base} ${pad} ${status === 'interested' ? active : idle}`}
      >
        <Star size={icon} strokeWidth={1.75} fill={status === 'interested' ? 'currentColor' : 'none'} /> Me interesa
      </button>
      <button
        type="button"
        onClick={() => choose('going')}
        disabled={busy || !ready}
        aria-pressed={status === 'going'}
        className={`${base} ${pad} ${status === 'going' ? active : idle}`}
      >
        <Check size={icon} strokeWidth={2} /> Asistiré
      </button>
    </div>
  )
}
