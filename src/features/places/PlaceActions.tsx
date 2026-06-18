'use client'

import { useState } from 'react'
import { Heart, Compass, Share2, Check } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { track } from '@/lib/track'

/**
 * Fila de acciones de la ficha de lugar: Guardar / Cómo llegar / Compartir.
 * Funciona con o sin sesión (guardados anónimos en localStorage). Registra
 * `save` / `directions` / `share` para las estadísticas del negocio.
 */
export function PlaceActions({
  placeId,
  slug,
  name,
  vibeLine,
  lat,
  lng,
}: {
  placeId: string
  slug: string
  name: string
  vibeLine: string | null
  lat: number | null
  lng: number | null
}) {
  const { isSaved, toggle } = useFavorites()
  const [copied, setCopied] = useState(false)
  const saved = isSaved(placeId)

  function onSave() {
    track(saved ? 'unsave' : 'save', { placeId })
    toggle(placeId)
  }

  async function onShare() {
    track('share', { placeId })
    const url = `${location.origin}/places/${slug}`
    const data = { title: name, text: vibeLine ?? name, url }
    if (navigator.share) {
      try { await navigator.share(data); return } catch { /* cancelado → cae al copiar */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* sin clipboard: no hacemos nada */ }
  }

  // Compacto en mobile (solo icono); icono + texto desde sm en adelante.
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-medium transition sm:px-4'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onSave}
        aria-label={saved ? 'Guardado' : 'Guardar'}
        className={`${base} ${saved ? 'border-goospe-green bg-goospe-green text-white' : 'border-line bg-card text-fg-soft hover:text-fg'}`}
      >
        <Heart size={17} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
        <span className="hidden sm:inline">{saved ? 'Guardado' : 'Guardar'}</span>
      </button>

      {lat != null && lng != null && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('directions', { placeId })}
          aria-label="Cómo llegar"
          className={`${base} border-line bg-card text-fg-soft hover:text-fg`}
        >
          <Compass size={17} strokeWidth={1.75} /> <span className="hidden sm:inline">Cómo llegar</span>
        </a>
      )}

      <button
        type="button"
        onClick={onShare}
        aria-label="Compartir"
        className={`${base} border-line bg-card text-fg-soft hover:text-fg`}
      >
        {copied ? <Check size={17} strokeWidth={2} /> : <Share2 size={17} strokeWidth={1.75} />}
        <span className="hidden sm:inline">{copied ? 'Enlace copiado' : 'Compartir'}</span>
      </button>
    </div>
  )
}
