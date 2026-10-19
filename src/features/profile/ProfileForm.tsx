'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2 } from 'lucide-react'
import { removeAvatar, updateProfile, uploadAvatar } from '@/actions/profile'
import { RESIZE_PRESETS } from '@/lib/image-resize'
import { UploadStatusList, useImageUploads } from '@/shared/components/upload-status'
import { toast } from '@/shared/components/toast'
import { cardClass, dangerBtn, fieldClass, ghostBtn, hintClass, labelClass, primaryBtn, sectionTitle } from '@/features/business/ui'
import { MIN_AGE, NAME_MAX, NAME_MIN, OLDEST_BIRTH_YEAR } from '@/features/profile/profile-schema'

export type CityOption = { id: number; name: string; region: string | null }
export type ProfileInitial = { displayName: string; avatarUrl: string | null; homeCityId: number | null; birthYear: number | null }

/** Foto de perfil: se optimiza en el navegador (512 px) antes de subir. */
function AvatarEditor({ initialUrl, initial }: { initialUrl: string | null; initial: string }) {
  const router = useRouter()
  const uploads = useImageUploads()
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [removing, setRemoving] = useState(false)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []) // copiar ANTES de limpiar el input (lista viva)
    if (inputRef.current) inputRef.current.value = ''
    const file = files[0]
    if (!file) return
    await uploads.uploadEach([file], RESIZE_PRESETS.logo, async (f) => {
      const fd = new FormData()
      fd.set('file', f)
      const res = await uploadAvatar(fd)
      if (res?.success && res.url) { setUrl(res.url); toast.success('Foto actualizada'); router.refresh() }
      return res
    })
  }

  async function onRemove() {
    setRemoving(true)
    const res = await removeAvatar()
    setRemoving(false)
    if (res?.error) { toast.error(res.error); return }
    setUrl(null)
    toast.success('Foto eliminada')
    router.refresh()
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionTitle}>Foto de perfil</h2>
      <p className={`mb-4 ${hintClass}`}>Se muestra junto a tus reseñas. JPG, PNG o WebP de hasta 5 MB.</p>
      <div className="flex flex-wrap items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Tu foto de perfil" className="h-20 w-20 rounded-full object-cover ring-2 ring-line" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-goospe-gradient text-3xl font-medium text-on-brand">{initial}</span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={`${ghostBtn} cursor-pointer ${uploads.busy ? 'pointer-events-none opacity-60' : ''}`}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={uploads.busy} className="sr-only" />
            <Camera size={16} strokeWidth={1.75} /> {url ? 'Cambiar foto' : 'Subir foto'}
          </label>
          {url && (
            <button type="button" onClick={onRemove} disabled={removing || uploads.busy} className={dangerBtn}>
              <Trash2 size={16} strokeWidth={1.75} /> {removing ? 'Quitando…' : 'Quitar'}
            </button>
          )}
        </div>
      </div>
      <UploadStatusList items={uploads.items} className="mt-3 max-w-sm" />
    </section>
  )
}

export function ProfileForm({ initial, cities }: { initial: ProfileInitial; cities: CityOption[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestYear = new Date().getFullYear() - MIN_AGE

  // onSubmit + FormData: con `action` React reinicia los campos si el servidor devuelve un error.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await updateProfile(new FormData(e.currentTarget))
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    toast.success('Perfil guardado')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <AvatarEditor initialUrl={initial.avatarUrl} initial={(initial.displayName || 'T').charAt(0).toUpperCase()} />

      <form onSubmit={onSubmit} className={`space-y-4 ${cardClass}`}>
        <h2 className={sectionTitle}>Tus datos</h2>
        <div>
          <label htmlFor="display_name" className={labelClass}>Nombre</label>
          <input id="display_name" name="display_name" type="text" required minLength={NAME_MIN} maxLength={NAME_MAX}
            autoComplete="name" defaultValue={initial.displayName} className={fieldClass} />
          <p className={`mt-1 ${hintClass}`}>Así apareces en tus reseñas.</p>
        </div>
        <div>
          <label htmlFor="home_city_id" className={labelClass}>Tu ciudad</label>
          <select id="home_city_id" name="home_city_id" defaultValue={initial.homeCityId ?? ''} className={fieldClass}>
            <option value="">Sin definir</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.region ? `${c.name}, ${c.region}` : c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="birth_year" className={labelClass}>Año de nacimiento <span className="font-normal text-muted">(opcional)</span></label>
          <input id="birth_year" name="birth_year" type="number" inputMode="numeric" min={OLDEST_BIRTH_YEAR} max={latestYear}
            placeholder="1995" defaultValue={initial.birthYear ?? ''} className={fieldClass} />
          <p className={`mt-1 ${hintClass}`}>No se muestra a nadie. Nos ayuda a recomendarte mejor.</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
    </div>
  )
}
