'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Botón "atrás" que respeta el historial del navegador (router.back()).
 * Si no hay historial previo —p. ej. el usuario llegó directo por un enlace
 * compartido— navega al `fallback` (por defecto el feed).
 */
export function BackButton({
  fallback = '/feed',
  label = 'Volver',
  className = '',
}: {
  fallback?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className={`inline-flex items-center gap-1.5 text-sm text-fg-soft transition hover:text-goospe-green ${className}`}
    >
      <ArrowLeft size={16} strokeWidth={1.75} /> {label}
    </button>
  )
}
