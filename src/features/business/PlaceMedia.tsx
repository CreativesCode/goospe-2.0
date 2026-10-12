'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { deleteOwnerPhoto, removePlaceImage, uploadOwnerPhoto, uploadPlaceImage } from '@/actions/owner-media'
import { PhotoImg } from '@/shared/components/photo-img'
import { toast } from '@/shared/components/toast'
import { UploadStatusList, useImageUploads } from '@/shared/components/upload-status'
import { RESIZE_PRESETS, type ResizePreset } from '@/lib/image-resize'
import { cardClass, ghostBtn, hintClass, linkBtn, sectionTitle } from '@/features/business/ui'

type Slot = 'cover' | 'logo'
export type OwnerPhoto = { id: string; url: string }
type Result = { error?: string } | undefined

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_MB = 5
/** Fotos propias que se pueden elegir de una vez (se suben de a una). */
const MAX_BATCH = 10

// Optimiza cada imagen en el navegador y la envía a una server action, mostrando la etapa de
// cada archivo. El tope de 5 MB se comprueba sobre lo que realmente se envía (ya optimizado).
function useUpload(run: (fd: FormData) => Promise<Result>, placeId: string, preset: ResizePreset, okMessage: (n: number) => string) {
  const router = useRouter()
  const uploads = useImageUploads()
  async function send(files: File[], extra: Record<string, string> = {}) {
    if (!files.length) return
    const ok = await uploads.uploadEach(files, preset, (file) => {
      const fd = new FormData()
      fd.set('place_id', placeId)
      fd.set('file', file)
      for (const [k, v] of Object.entries(extra)) fd.set(k, v)
      return run(fd)
    })
    if (ok > 0) { toast.success(okMessage(ok)); router.refresh() }
  }
  return { busy: uploads.busy, items: uploads.items, send }
}

function ImageSlot({ placeId, slot, url, name }: { placeId: string; slot: Slot; url: string | null; name: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const isCover = slot === 'cover'
  const { busy, items, send } = useUpload(uploadPlaceImage, placeId, isCover ? RESIZE_PRESETS.photo : RESIZE_PRESETS.logo, () => (isCover ? 'Portada actualizada' : 'Logo actualizado'))
  const [removing, setRemoving] = useState(false)

  async function remove() {
    if (!window.confirm(isCover ? '¿Quitar la foto de portada?' : '¿Quitar el logo?')) return
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('slot', slot)
    setRemoving(true)
    const res = await removePlaceImage(fd)
    setRemoving(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success(isCover ? 'Portada quitada' : 'Logo quitado')
    router.refresh()
  }

  return (
    <div className={isCover ? 'min-w-0 flex-1' : 'shrink-0'}>
      <p className="mb-2 text-sm font-medium text-fg">{isCover ? 'Foto de portada' : 'Logo'}</p>
      <PhotoImg
        key={url ?? 'vacio'} // al cambiar la imagen se reinicia el estado de "falló al cargar"
        src={url}
        alt={isCover ? `Portada de ${name}` : `Logo de ${name}`}
        className={isCover ? 'aspect-[16/9] w-full rounded-xl object-cover' : 'h-24 w-24 rounded-full border border-line object-cover'}
        isoClassName={isCover ? 'h-10 w-10' : 'h-8 w-8'}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => { void send(Array.from(e.target.files ?? []).slice(0, 1), { slot }); e.target.value = '' }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`min-h-11 ${linkBtn}`}>
          <Upload size={14} strokeWidth={2} /> {url ? 'Cambiar' : 'Subir'}
        </button>
        {url && (
          <button type="button" disabled={removing} onClick={remove} className="min-h-11 text-sm text-red-600 hover:underline disabled:opacity-60 dark:text-red-400">
            Quitar
          </button>
        )}
      </div>
      <UploadStatusList items={items} className={isCover ? 'mt-1' : 'mt-1 w-56 max-w-full'} />
    </div>
  )
}

function OwnPhotos({ placeId, photos: allPhotos, name }: { placeId: string; photos: OwnerPhoto[]; name: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { busy, items, send } = useUpload(uploadOwnerPhoto, placeId, RESIZE_PRESETS.photo, (n) => (n === 1 ? 'Foto publicada en tu ficha' : `${n} fotos publicadas en tu ficha`))
  const [deleting, setDeleting] = useState<string | null>(null)
  // Se oculta al instante: el refresco del servidor tarda unos segundos en llegar.
  const [removed, setRemoved] = useState<string[]>([])
  const photos = allPhotos.filter((p) => !removed.includes(p.id))

  async function remove(id: string) {
    if (!window.confirm('¿Eliminar esta foto de tu ficha?')) return
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('photo_id', id)
    setDeleting(id)
    const res = await deleteOwnerPhoto(fd)
    setDeleting(null)
    if (res?.error) { toast.error(res.error); return }
    setRemoved((r) => [...r, id])
    toast.success('Foto eliminada')
    router.refresh()
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg">Tus fotos <span className="font-normal text-muted">({photos.length})</span></p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
          onChange={(e) => { void send(Array.from(e.target.files ?? []).slice(0, MAX_BATCH)); e.target.value = '' }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={ghostBtn}>
          <ImagePlus size={16} strokeWidth={1.75} /> Agregar fotos
        </button>
      </div>
      <UploadStatusList items={items} className="mb-3" />
      {photos.length === 0 ? (
        <p className="text-sm text-muted">Aún no subes fotos propias. Las tuyas se publican al instante, sin revisión.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((ph) => (
            <li key={ph.id} className="relative">
              <PhotoImg src={ph.url} alt={`Foto de ${name}`} className="aspect-square w-full rounded-xl object-cover" />
              <button type="button" onClick={() => remove(ph.id)} disabled={deleting === ph.id} aria-label="Eliminar foto"
                className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 disabled:opacity-60">
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Portada, logo y fotos propias del negocio. */
export function PlaceMedia({ placeId, name, coverUrl, logoUrl, photos }: {
  placeId: string; name: string; coverUrl: string | null; logoUrl: string | null; photos: OwnerPhoto[]
}) {
  return (
    <section id="fotos" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={sectionTitle}>Imágenes</h2>
      <p className={`mb-4 ${hintClass}`}>La portada es la primera foto de tu ficha y de tu card en el feed. JPG, PNG o WebP: las optimizamos en tu dispositivo antes de subirlas (hasta {MAX_MB} MB ya optimizadas).</p>
      <div className="flex flex-col gap-5 sm:flex-row">
        <ImageSlot placeId={placeId} slot="cover" url={coverUrl} name={name} />
        <ImageSlot placeId={placeId} slot="logo" url={logoUrl} name={name} />
      </div>
      <OwnPhotos placeId={placeId} photos={photos} name={name} />
    </section>
  )
}
