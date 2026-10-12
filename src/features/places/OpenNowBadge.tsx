'use client'

import { useEffect, useState } from 'react'
import { openNow } from '@/lib/hours'

/**
 * Pastilla "Abierto ahora" / "Cerrado ahora" calculada en el NAVEGADOR con la zona horaria de
 * la ciudad del lugar. Va en cliente a propósito: la ficha y el feed se cachean (ISR), así que
 * calcularla en el servidor dejaría el estado congelado hasta la siguiente regeneración.
 * No pinta nada si no hay horario o no se pudo interpretar.
 */
export function OpenNowBadge({
  hours,
  timezone,
  onlyOpen = false,
  tone = 'photo',
  className = '',
}: {
  hours: { osm_raw?: string | null } | null | undefined
  timezone: string | null | undefined
  /** Solo muestra "Abierto" (cards del feed: no ensuciar con "Cerrado"). */
  onlyOpen?: boolean
  /** 'photo' = sobre una imagen; 'surface' = sobre el fondo de la página (ficha). */
  tone?: 'photo' | 'surface'
  className?: string
}) {
  const raw = hours?.osm_raw ?? null
  const [open, setOpen] = useState<boolean | null>(null)

  // Tras montar (evita mismatch de hidratación) y se refresca cada minuto.
  useEffect(() => {
    if (!raw) { setOpen(null); return }
    const tick = () => setOpen(openNow({ osm_raw: raw }, timezone))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [raw, timezone])

  if (open === null || (onlyOpen && !open)) return null
  const color =
    tone === 'surface'
      ? open ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-line text-fg-soft'
      : open ? 'bg-goospe-green text-white' : 'bg-black/40 text-white ring-1 ring-white/20'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {open ? 'Abierto ahora' : 'Cerrado ahora'}
    </span>
  )
}
