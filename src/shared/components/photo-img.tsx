'use client'

import { useState } from 'react'

/**
 * <img> con fallback al gradiente + isotipo de marca si la foto falla a cargar.
 * Pensada para usarse desde server components (que no pueden definir onError).
 * `className` aplica tanto a la imagen como al contenedor del fallback (mismas dimensiones).
 */
export function PhotoImg({
  src,
  alt,
  className,
  isoClassName = 'h-9 w-9',
}: {
  src: string
  alt: string
  className?: string
  isoClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-goospe-gradient ${className ?? ''}`}>
        <img src="/brand/isotipo-white.svg" alt="" className={`${isoClassName} opacity-90`} />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} />
  )
}
