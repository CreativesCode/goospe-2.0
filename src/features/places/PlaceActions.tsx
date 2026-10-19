'use client'

import { useState } from 'react'
import { Heart, Compass, Share2, Check } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { track } from '@/lib/track'
import { toast } from '@/shared/components/toast'

const GLASS = 'inline-flex h-[46px] items-center gap-[7px] rounded-full bg-white/[0.16] px-[18px] text-sm font-medium backdrop-blur-[8px] transition hover:bg-white/25'
const ROUND = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg transition'

/**
 * Acciones de la ficha de lugar: Guardar / Cómo llego / Compartir. Un solo componente pinta
 * las dos presentaciones para compartir el estado de guardado:
 *  - tablet/web: botones sobre la portada (vidrio + "Cómo llego" en blanco);
 *  - móvil: barra fija sobre la tab bar (corazón + compartir + "Cómo llego" a lo ancho).
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
  const directions = lat != null && lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null

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
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const onDirections = () => track('directions', { placeId })
  const shareIcon = copied ? <Check size={17} strokeWidth={2} /> : <Share2 size={17} strokeWidth={1.75} />

  return (
    <>
      {/* tablet / web: sobre la portada */}
      <div className="hidden shrink-0 flex-wrap gap-2 md:flex">
        <button type="button" onClick={onSave} aria-pressed={saved} className={`${GLASS} ${saved ? 'text-goospe-green-light' : 'text-white'}`}>
          <Heart size={17} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Guardado' : 'Guardar'}
        </button>
        <button type="button" onClick={onShare} className={`${GLASS} text-white`}>
          {shareIcon} {copied ? 'Enlace copiado' : 'Compartir'}
        </button>
        {directions && (
          <a href={directions} target="_blank" rel="noreferrer" onClick={onDirections}
            className="inline-flex h-[46px] items-center gap-[7px] rounded-full bg-white px-[18px] text-sm font-medium text-[#1C1C1A] transition hover:bg-white/90">
            <Compass size={17} strokeWidth={1.75} /> Cómo llego
          </a>
        )}
      </div>

      {/* móvil: barra fija sobre la tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+var(--sab))] z-20 flex gap-2 border-t border-line bg-surface/[0.94] px-4 py-2.5 backdrop-blur-[12px] md:hidden">
        <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
          className={saved ? `${ROUND} !border-goospe-green !bg-goospe-green !text-on-brand` : ROUND}>
          <Heart size={19} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button type="button" onClick={onShare} aria-label={copied ? 'Enlace copiado' : 'Compartir'} className={ROUND}>
          {shareIcon}
        </button>
        {directions && (
          <a href={directions} target="_blank" rel="noreferrer" onClick={onDirections}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-goospe-green font-medium text-on-brand">
            <Compass size={18} strokeWidth={1.75} /> Cómo llego
          </a>
        )}
      </div>
    </>
  )
}
