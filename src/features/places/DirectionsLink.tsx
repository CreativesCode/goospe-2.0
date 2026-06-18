'use client'

import { Compass } from 'lucide-react'
import { track } from '@/lib/track'

/**
 * Enlace "Cómo llegar" que registra la interacción `directions` (alimenta las
 * estadísticas del panel del negocio). Úsalo en cualquier vista server.
 */
export function DirectionsLink({
  placeId,
  lat,
  lng,
  className = 'inline-flex items-center gap-1.5 text-sm text-goospe-green hover:underline',
  label = 'Cómo llegar',
}: {
  placeId: string
  lat: number
  lng: number
  className?: string
  label?: string
}) {
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      onClick={() => track('directions', { placeId })}
      className={className}
    >
      <Compass size={15} strokeWidth={1.75} /> {label}
    </a>
  )
}
