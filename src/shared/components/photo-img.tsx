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
 * <img> con fallback si la foto falla a cargar (o no hay). Por defecto, gradiente + isotipo
 * de marca; con `fallback` se pinta ese contenido (p. ej. el icono de la categoría).
 * Pensada para usarse desde server components (que no pueden definir onError).
 * `className` aplica tanto a la imagen como al contenedor del fallback (mismas dimensiones).
 */
export function PhotoImg({
  src,
  alt,
  className,
  isoClassName = 'h-9 w-9',
  fallback,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  isoClassName?: string
  fallback?: ReactNode
}) {
  const { failed, ref, onError } = useImgFallback()
  if (failed || !src) {
    return (
      <div className={`flex items-center justify-center bg-goospe-gradient text-white ${className ?? ''}`}>
        {fallback ?? <img src="/brand/isotipo-white.svg" alt="" className={`${isoClassName} opacity-90`} />}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt={alt} loading="lazy" decoding="async" onError={onError} className={className} />
  )
}
