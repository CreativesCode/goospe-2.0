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
  short = false,
  className = '',
}: {
  hours: { osm_raw?: string | null } | null | undefined
  timezone: string | null | undefined
  /** Solo muestra "Abierto" (cards del feed: no ensuciar con "Cerrado"). */
  onlyOpen?: boolean
  /** 'photo' = sobre una imagen; 'surface' = sobre el fondo de la página (ficha). */
  tone?: 'photo' | 'surface'
  /** Texto corto ("Abierto" / "Cerrado") para tarjetas pequeñas. */
  short?: boolean
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
      ? open ? 'bg-tint text-ink' : 'bg-line text-fg-soft'
      : open ? 'bg-goospe-green text-on-brand' : 'bg-[rgba(10,10,9,0.55)] text-white'
  return (
    <span className={`inline-flex items-center rounded-full px-[11px] py-[5px] text-xs font-medium leading-none ${color} ${className}`}>
      {open ? (short ? 'Abierto' : 'Abierto ahora') : short ? 'Cerrado' : 'Cerrado ahora'}
    </span>
  )
}
