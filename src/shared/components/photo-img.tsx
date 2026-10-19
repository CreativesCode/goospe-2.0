'use client'

import { useCallback, useState, type ReactNode } from 'react'

/**
 * Estado "la foto falló" para un <img>. Además de `onError`, el ref detecta las imágenes que
 * ya fallaron ANTES de hidratar (HTML del servidor): ese evento `error` se pierde y la card se
 * quedaba con el icono de imagen rota. Con las fotos de Google caídas es el caso normal.
 */
export function useImgFallback() {
  const [failed, setFailed] = useState(false)
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) setFailed(true)
  }, [])
  const onError = useCallback(() => setFailed(true), [])
  return { failed, ref, onError }
}

/**
 * Fondo del estado sin foto. `tint`: relleno verde suave + icono #2dc186 (tarjetas, miniaturas).
 * `deep`: degradado radial oscuro + icono blanco, para superficies grandes con texto encima
 * (mazo del feed, portada de la ficha). Sustituye al degradado de marca plano de antes.
 */
export const NO_PHOTO = {
  tint: 'bg-tint text-goospe-green',
  deep: 'bg-goospe-deep text-white/90',
} as const
export type NoPhotoTone = keyof typeof NO_PHOTO

/**
 * <img> con fallback si la foto falla a cargar (o no hay): fondo `tone` + el contenido de
 * `fallback` (p. ej. el icono de la categoría) o, sin él, el isotipo.
 * Pensada para usarse desde server components (que no pueden definir onError).
 * `className` aplica tanto a la imagen como al contenedor del fallback (mismas dimensiones).
 */
export function PhotoImg({
  src,
  alt,
  className,
  isoClassName = 'h-9 w-9',
  fallback,
  tone = 'tint',
  priority = false,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  isoClassName?: string
  fallback?: ReactNode
  tone?: NoPhotoTone
  /** Imagen principal de la vista (LCP): carga inmediata y con prioridad. */
  priority?: boolean
}) {
  const { failed, ref, onError } = useImgFallback()
  if (failed || !src) {
    return (
      <div className={`flex items-center justify-center ${NO_PHOTO[tone]} ${className ?? ''}`}>
        {fallback ?? (
          <img
            src={tone === 'deep' ? '/brand/isotipo-white.svg' : '/brand/isotipo-color.svg'}
            alt=""
            className={`${isoClassName} opacity-90`}
          />
        )}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={onError}
      className={`bg-ph ${className ?? ''}`}
    />
  )
}
