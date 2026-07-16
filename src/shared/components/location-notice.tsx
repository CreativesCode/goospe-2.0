'use client'

import { MapPin, RefreshCw } from 'lucide-react'
import type { GeoSource } from '@/lib/geo'

/**
 * Aviso cuando la ubicación es el fallback (centro por defecto: permiso denegado / expirado).
 * Sin esto, las distancias se miden desde el centro de la ciudad y se muestran como
 * "cerca de ti" sin que el usuario lo sepa. Solo se renderiza cuando hace falta.
 */
export function LocationNotice({
  source,
  onRetry,
  className = '',
}: {
  source: GeoSource
  onRetry?: () => void
  className?: string
}) {
  if (source !== 'fallback') return null

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-fg-soft ${className}`}
    >
      <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-goospe-green" />
      <span className="min-w-0 flex-1">
        Mostrando una <b className="font-medium text-fg">ubicación aproximada</b> — activa tu ubicación para distancias reales.
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-goospe-green/10 px-3 py-1 text-xs font-medium text-goospe-green-dark transition hover:bg-goospe-green/20"
        >
          <RefreshCw size={13} strokeWidth={2} /> Reintentar
        </button>
      )}
    </div>
  )
}
