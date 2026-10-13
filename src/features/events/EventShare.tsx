'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { track } from '@/lib/track'
import { toast } from '@/shared/components/toast'

/**
 * Compartir un evento: hoja nativa del sistema si existe (móvil); si no, copia el enlace.
 * Registra `share` con el event_id para las estadísticas del negocio.
 */
export function EventShare({ eventId, name, text, className = '' }: {
  eventId: string
  name: string
  text: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onShare() {
    track('share', { eventId })
    const url = `${window.location.origin}/events/${eventId}`
    if (navigator.share) {
      try { await navigator.share({ title: name, text, url }); return } catch { /* cancelado → cae al copiar */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <button type="button" onClick={onShare} className={className}>
      {copied ? <Check size={17} strokeWidth={2} /> : <Share2 size={17} strokeWidth={1.75} />}
      {copied ? 'Enlace copiado' : 'Compartir'}
    </button>
  )
}
