'use client'

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type Photo = { id?: string; url: string }

/**
 * Galería de fotos del lugar. Al tocar una foto se abre a pantalla completa
 * (lightbox) con navegación entre fotos, cierre con Escape / clic en el fondo
 * y bloqueo del scroll de fondo mientras está abierta.
 */
export function PhotoGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const open = index !== null
  const close = useCallback(() => setIndex(null), [])
  const step = useCallback(
    (dir: number) => setIndex((i) => (i === null ? i : (i + dir + photos.length) % photos.length)),
    [photos.length],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close, step])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((ph, i) => (
          <button
            key={ph.id ?? i}
            type="button"
            onClick={() => setIndex(i)}
            className="overflow-hidden rounded-xl"
            aria-label="Ver foto a pantalla completa"
          >
            <img
              src={ph.url}
              alt={alt}
              className="aspect-[4/3] w-full cursor-zoom-in object-cover transition duration-300 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={22} strokeWidth={2} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(-1) }}
                aria-label="Foto anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronLeft size={26} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(1) }}
                aria-label="Foto siguiente"
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronRight size={26} strokeWidth={2} />
              </button>
            </>
          )}

          <img
            src={photos[index].url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
          />

          {photos.length > 1 && (
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {index + 1} / {photos.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}
