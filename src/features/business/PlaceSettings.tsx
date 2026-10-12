'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Eye, MapPin, Store } from 'lucide-react'
import { setPlacePaused, updateBrandVoice } from '@/actions/owner-requests'
import { toast } from '@/shared/components/toast'
import { ChangeRequestBox } from '@/features/business/ChangeRequestBox'
import { BRAND_VOICE_MAX } from '@/features/business/owner-schemas'
import { cardClass, dangerBtn, fieldClass, ghostBtn, hintClass, labelClass, primaryBtn, sectionTitle } from '@/features/business/ui'

export type PlaceVisibility = 'visible' | 'paused' | 'hidden_by_admin'

/** Nombre y pin del mapa: no los cambia el dueño; pide el cambio a Goospe. */
export function PlaceIdentity({ placeId, name, addressLine, mapUrl, pendingKinds }: {
  placeId: string; name: string; addressLine: string | null; mapUrl: string | null; pendingKinds: string[]
}) {
  return (
    <section className={cardClass}>
      <h2 className={sectionTitle}>Nombre y ubicación</h2>
      <p className={`mb-4 ${hintClass}`}>Estos dos datos los valida nuestro equipo antes de cambiarlos.</p>
      <div className="space-y-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-fg"><Store size={16} strokeWidth={1.75} className="shrink-0 text-goospe-green" /> <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span></p>
          <ChangeRequestBox placeId={placeId} kind="name" pending={pendingKinds.includes('name')} />
        </div>
        <div className="border-t border-line pt-4">
          <p className="flex items-center gap-2 text-sm text-fg">
            <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-goospe-green" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{addressLine ?? 'Sin dirección'}</span>
          </p>
          {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-6 text-xs text-goospe-green hover:underline">Ver el pin actual en el mapa</a>}
          <div><ChangeRequestBox placeId={placeId} kind="location" pending={pendingKinds.includes('location')} /></div>
        </div>
      </div>
    </section>
  )
}

/** "Cerrado temporalmente": el dueño oculta su lugar y lo reactiva cuando quiera (con confirmación). */
export function PlaceStatus({ placeId, visibility }: { placeId: string; visibility: PlaceVisibility }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const paused = visibility === 'paused'

  async function apply(next: boolean) {
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('paused', next ? '1' : '0')
    setBusy(true)
    const res = await setPlacePaused(fd)
    setBusy(false)
    setConfirming(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success(next ? 'Tu lugar quedó oculto' : 'Tu lugar vuelve a estar visible')
    router.refresh()
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionTitle}>Visibilidad</h2>
      {visibility === 'hidden_by_admin' ? (
        <p className="mt-2 text-sm text-fg-soft">Este lugar está oculto por el equipo de Goospe. Escríbenos si crees que es un error.</p>
      ) : paused ? (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-fg-soft"><strong className="text-fg">Cerrado temporalmente.</strong> No aparece en el feed, en la búsqueda ni en los listados. Tus datos, fotos y reseñas se conservan.</p>
          <button type="button" disabled={busy} onClick={() => apply(false)} className={primaryBtn}>
            <Eye size={16} strokeWidth={1.75} /> {busy ? 'Reactivando…' : 'Volver a mostrar mi lugar'}
          </button>
        </div>
      ) : confirming ? (
        <div role="alertdialog" aria-labelledby="pause-title" className="mt-2 space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <p id="pause-title" className="text-sm text-fg">¿Ocultar tu lugar? Dejará de aparecer en Goospe hasta que lo reactives. Tus eventos próximos tampoco se mostrarán.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => apply(true)} className={dangerBtn}>{busy ? 'Ocultando…' : 'Sí, ocultar'}</button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={ghostBtn}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-fg-soft">Tu lugar está visible. Si cierras por vacaciones o reformas, puedes ocultarlo un tiempo.</p>
          <button type="button" onClick={() => setConfirming(true)} className={ghostBtn}><EyeOff size={16} strokeWidth={1.75} /> Cerrar temporalmente</button>
        </div>
      )}
    </section>
  )
}

/** Tono de marca del negocio: lo usa la IA al redactar promos y respuestas a reseñas. */
export function BrandVoiceForm({ placeId, brandVoice, canEdit, placesCount }: {
  placeId: string; brandVoice: string | null; canEdit: boolean; placesCount: number
}) {
  const [value, setValue] = useState(brandVoice ?? '')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('brand_voice', value)
    setBusy(true)
    const res = await updateBrandVoice(fd)
    setBusy(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success('Tono de marca guardado')
  }

  return (
    <section id="negocio" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={sectionTitle}>Tono de marca</h2>
      <p className={`mb-3 ${hintClass}`}>
        Cuéntale al asistente cómo habla tu negocio. Lo usa al redactar eventos y respuestas a reseñas
        {placesCount > 1 ? ` de tus ${placesCount} lugares.` : '.'}
      </p>
      <form onSubmit={onSubmit}>
        <label className={labelClass} htmlFor="brand_voice">¿Cómo le hablas a tus clientes?</label>
        <textarea id="brand_voice" value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={BRAND_VOICE_MAX}
          disabled={!canEdit} placeholder="Ej: cercano y con humor, tuteamos, sin tecnicismos, firmamos como “el equipo de La Marca”."
          className={fieldClass} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {canEdit
            ? <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Guardando…' : 'Guardar tono'}</button>
            : <p className={hintClass}>Solo el dueño del negocio puede cambiarlo.</p>}
          <span className={hintClass}>{value.length}/{BRAND_VOICE_MAX}</span>
        </div>
      </form>
    </section>
  )
}
