'use client'

import { Check, Star } from 'lucide-react'
import { useRsvp } from './use-rsvp'

const base = 'inline-flex items-center justify-center gap-1.5 rounded-full border font-medium transition disabled:opacity-60'
const idle = 'border-line text-fg hover:border-goospe-green/50'
const active = 'border-goospe-green bg-goospe-green text-on-brand'

/**
 * Respuesta a un evento con dos opciones separadas: "Me interesa" y "Asistiré". Solo
 * "Asistiré" suma al conteo público de asistentes. `size="lg"` es el de la página del evento;
 * `fill` reparte los dos botones a lo ancho de la tarjeta (cartelera).
 */
export function RsvpButton({ eventId, size = 'sm', fill = false }: { eventId: string; size?: 'sm' | 'lg'; fill?: boolean }) {
  const { status, busy, ready, choose } = useRsvp(eventId)
  const pad = fill ? 'h-10 flex-1 px-3 text-sm' : size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-3.5 text-[13px]'
  const icon = size === 'lg' || fill ? 16 : 14
  return (
    <div role="group" aria-label="Tu respuesta al evento" aria-busy={busy} className={`flex gap-2 ${fill ? '' : 'shrink-0 flex-wrap'}`}>
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
