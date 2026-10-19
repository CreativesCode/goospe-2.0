'use client'

import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { claimPlace } from '@/actions/business'
import { fieldClass, ghostBtn, primaryBtn } from '@/features/business/ui'

const inp = `${fieldClass} !mt-0`

/**
 * Botón "Soy el dueño" que despliega un formulario de solicitud de reclamo con datos de
 * contacto. Envía a la acción `claimPlace` (queda pendiente de revisión del admin).
 */
export function ClaimRequestForm({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${primaryBtn} shrink-0`}>
        Soy el dueño
      </button>
    )
  }

  return (
    <form action={claimPlace} className="flex w-full basis-full flex-col gap-2.5 rounded-[18px] border border-goospe-green/30 bg-tint p-4">
      <input type="hidden" name="place_id" value={placeId} />
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <BadgeCheck size={14} strokeWidth={1.75} /> Solicitar administrar «{placeName}»
      </p>
      <input name="contact_name" placeholder="Tu nombre" className={inp} />
      <input name="phone" placeholder="Teléfono de contacto" className={inp} />
      <textarea name="message" rows={2} placeholder="¿Cómo confirmamos que es tu negocio? (opcional)" className={inp} />
      <p className="text-[11px] text-muted">Revisamos cada solicitud personalmente y te contactamos para confirmar.</p>
      <div className="flex items-center gap-2">
        <button type="submit" className={primaryBtn}>
          Enviar solicitud
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${ghostBtn} bg-card`}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
