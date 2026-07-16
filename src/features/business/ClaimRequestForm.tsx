'use client'

import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { claimPlace } from '@/actions/business'

const inp = 'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green'

/**
 * Botón "Soy el dueño" que despliega un formulario de solicitud de reclamo con datos de
 * contacto. Envía a la acción `claimPlace` (queda pendiente de revisión del admin).
 */
export function ClaimRequestForm({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-goospe-green px-4 py-2 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
        >
          Soy el dueño
        </button>
      </div>
    )
  }

  return (
    <form action={claimPlace} className="mt-3 w-full space-y-2 rounded-xl border border-goospe-green/30 bg-goospe-green/5 p-3">
      <input type="hidden" name="place_id" value={placeId} />
      <p className="flex items-center gap-1.5 text-xs font-medium text-goospe-green-dark">
        <BadgeCheck size={14} strokeWidth={1.75} /> Solicitar administrar «{placeName}»
      </p>
      <input name="contact_name" placeholder="Tu nombre" className={inp} />
      <input name="phone" placeholder="Teléfono de contacto" className={inp} />
      <textarea name="message" rows={2} placeholder="¿Cómo confirmamos que es tu negocio? (opcional)" className={inp} />
      <p className="text-[11px] text-muted">Revisamos cada solicitud personalmente y te contactamos para confirmar.</p>
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow">
          Enviar solicitud
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-2 text-sm text-fg-soft">
          Cancelar
        </button>
      </div>
    </form>
  )
}
