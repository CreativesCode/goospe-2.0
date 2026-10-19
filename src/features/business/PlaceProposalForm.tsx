'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { proposePlace } from '@/actions/place-proposals'
import { toast } from '@/shared/components/toast'
import { fieldClass, hintClass, labelClass, primaryBtn } from '@/features/business/ui'
import {
  PROPOSAL_ADDRESS_MAX, PROPOSAL_CITY_MAX, PROPOSAL_NAME_MAX, PROPOSAL_REFERENCE_MAX,
} from '@/features/business/place-proposal-schema'

export type ProposalCategory = { id: number; name: string; emoji: string | null }
export type ProposalCity = { id: number; name: string; country: string }

const OTHER_CITY = 'other'

/**
 * Formulario de "proponer un lugar nuevo". La ubicación se indica igual que en una solicitud
 * de cambio de pin: enlace de mapa, "lat, lng" o una descripción (el equipo ubica el pin).
 */
export function PlaceProposalForm({ categories, cities, defaultName = '' }: {
  categories: ProposalCategory[]; cities: ProposalCity[]; defaultName?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [city, setCity] = useState('')

  // onSubmit (no `<form action>`): React reinicia los campos no controlados al terminar una
  // acción y un error del servidor borraría lo escrito.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (city === OTHER_CITY) fd.set('city_id', '')
    else fd.delete('city_name')
    setBusy(true); setError(null)
    const res = await proposePlace(fd).catch(() => ({ error: 'No pudimos enviar la propuesta. Revisa tu conexión.' }))
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    toast.success('Propuesta enviada. Te avisaremos cuando la revisemos.')
    router.push('/panel#solicitudes')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className={labelClass}>
        Nombre del lugar
        <input name="name" required minLength={2} maxLength={PROPOSAL_NAME_MAX} defaultValue={defaultName} className={fieldClass} />
      </label>

      <label className={labelClass}>
        Categoría
        <select name="category_id" required defaultValue="" className={`select-chevron ${fieldClass}`}>
          <option value="" disabled>Elige una categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>)}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Dirección
          <input name="address" required minLength={3} maxLength={PROPOSAL_ADDRESS_MAX} placeholder="Calle y número" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Ciudad
          <select name="city_id" required value={city} onChange={(e) => setCity(e.target.value)} className={`select-chevron ${fieldClass}`}>
            <option value="" disabled>Elige la ciudad</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.country}</option>)}
            <option value={OTHER_CITY}>Otra (no aparece en la lista)</option>
          </select>
        </label>
      </div>
      {city === OTHER_CITY && (
        <label className={labelClass}>
          ¿En qué ciudad está?
          <input name="city_name" required maxLength={PROPOSAL_CITY_MAX} placeholder="Ciudad y país" className={fieldClass} />
        </label>
      )}

      <label className={labelClass}>
        Ubicación en el mapa
        <input name="reference" required minLength={5} maxLength={PROPOSAL_REFERENCE_MAX}
          placeholder="https://maps.app.goo.gl/… o -41.3195, -72.9854" className={fieldClass} />
        <span className={`mt-1 block font-normal ${hintClass}`}>
          Pega el enlace de Google Maps del local o sus coordenadas (lat, lng). Si no los tienes, describe dónde está y nuestro equipo ubica el pin.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Teléfono <span className="font-normal text-muted">(opcional)</span>
          <input name="phone" type="tel" maxLength={30} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Sitio web <span className="font-normal text-muted">(opcional)</span>
          <input name="website" inputMode="url" maxLength={300} placeholder="tunegocio.cl" className={fieldClass} />
        </label>
      </div>

      <label className={labelClass}>
        Nota para el equipo <span className="font-normal text-muted">(opcional)</span>
        <textarea name="message" rows={3} maxLength={1000} placeholder="Cuéntanos tu relación con el lugar o cómo confirmamos que existe." className={fieldClass} />
      </label>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        <Send size={15} strokeWidth={1.75} /> {busy ? 'Enviando…' : 'Enviar propuesta'}
      </button>
      <p className={hintClass}>Revisamos cada propuesta a mano. Si la aprobamos, el lugar se publica y quedas como su administrador.</p>
    </form>
  )
}
