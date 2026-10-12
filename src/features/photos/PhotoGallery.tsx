'use client'

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type Photo = { id?: string; url: string }

/**
 * Galería de fotos del lugar. Al tocar una foto se abre a pantalla completa
 * (lightbox) con navegación entre fotos, cierre con Escape / clic en el fondo
 * y bloqueo del scroll de fondo mientras está abierta.
 *
 * Las fotos que no cargan (p. ej. las de Google mientras su API no responde) se QUITAN de la
 * galería en vez de dejar un mosaico de huecos; si no queda ninguna se pinta `empty`.
 */
export function PhotoGallery({ photos, alt, empty = null }: { photos: Photo[]; alt: string; empty?: ReactNode }) {
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const markFailed = useCallback(
    (url: string) => setFailed((s) => (s.has(url) ? s : new Set(s).add(url))),
    [],
  )
  // Las que fallaron antes de hidratar no disparan onError: se detectan al montar el <img>.
  const checkBroken = useCallback(
    (el: HTMLImageElement | null, url: string) => {
      if (el && el.complete && el.naturalWidth === 0) markFailed(url)
    },
    [markFailed],
  )
  const visible = photos.filter((ph) => !failed.has(ph.url))

  const [index, setIndex] = useState<number | null>(null)
  // Si la foto abierta falla y la lista se acorta, el índice se reajusta (o se cierra).
  const current = index === null || visible.length === 0 ? null : Math.min(index, visible.length - 1)
  const open = current !== null
  const close = useCallback(() => setIndex(null), [])
  const count = visible.length
  const step = useCallback(
    (dir: number) => setIndex((i) => (i === null || count === 0 ? null : (Math.min(i, count - 1) + dir + count) % count)),
    [count],
  )
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Recuerda qué tenía el foco (el thumbnail) para devolvérselo al cerrar.
    const prevFocus = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowRight') { step(1); return }
      if (e.key === 'ArrowLeft') { step(-1); return }
      // Focus trap: el Tab no escapa del overlay.
      if (e.key === 'Tab') {
        const list = dialogRef.current?.querySelectorAll<HTMLElement>('button')
        if (!list || list.length === 0) return
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prevFocus?.focus() // restaura el foco al thumbnail
    }
  }, [open, close, step])

  if (visible.length === 0) return <>{empty}</>

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((ph, i) => (
          <button
            key={ph.id ?? ph.url}
            type="button"
            onClick={() => setIndex(i)}
            className="overflow-hidden rounded-xl"
            aria-label="Ver foto a pantalla completa"
          >
            <img
              ref={(el) => checkBroken(el, ph.url)}
              src={ph.url}
              alt={alt}
              onError={() => markFailed(ph.url)}
              className="aspect-[4/3] w-full cursor-zoom-in object-cover transition duration-300 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {current !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Foto a pantalla completa"
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={22} strokeWidth={2} />
          </button>

          {visible.length > 1 && (
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
            src={visible[current].url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            onError={() => markFailed(visible[current].url)}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
          />

          {visible.length > 1 && (
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {current + 1} / {visible.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}
