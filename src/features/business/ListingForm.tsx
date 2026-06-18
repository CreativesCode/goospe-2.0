'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { updateListing } from '@/actions/business'

type Place = {
  id: string
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  price_level: number | null
  tags: string[] | null
}

const field = 'mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30'
const lbl = 'block text-sm font-medium text-fg'

export function ListingForm({ place }: { place: Place }) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setSaving(true)
    setMsg(null)
    const res = await updateListing(formData)
    setSaving(false)
    if (res?.error) setMsg({ ok: false, text: res.error })
    else setMsg({ ok: true, text: 'Cambios guardados' })
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="place_id" value={place.id} />

      <div>
        <label className={lbl} htmlFor="vibe_line">Frase de identidad</label>
        <input id="vibe_line" name="vibe_line" defaultValue={place.vibe_line ?? ''} maxLength={80}
          placeholder="Ej: El mejor café de especialidad junto al lago" className={field} />
      </div>

      <div>
        <label className={lbl} htmlFor="description">Descripción</label>
        <textarea id="description" name="description" defaultValue={place.description ?? ''} rows={4}
          className={field} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl} htmlFor="phone">Teléfono</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={place.phone ?? ''} className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={place.whatsapp ?? ''} className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="website">Sitio web</label>
          <input id="website" name="website" type="url" inputMode="url" autoComplete="url" placeholder="https://…" defaultValue={place.website ?? ''} className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="instagram">Instagram</label>
          <input id="instagram" name="instagram" defaultValue={place.instagram ?? ''}
            placeholder="@tunegocio" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl} htmlFor="price_level">Rango de precio</label>
          <select id="price_level" name="price_level" defaultValue={place.price_level ?? ''} className={`${field} select-chevron`}>
            <option value="">Sin especificar</option>
            <option value="1">$ — económico</option>
            <option value="2">$$ — moderado</option>
            <option value="3">$$$ — alto</option>
            <option value="4">$$$$ — premium</option>
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="tags">Etiquetas (separadas por coma)</label>
          <input id="tags" name="tags" defaultValue={(place.tags ?? []).join(', ')}
            placeholder="café, pet friendly, wifi" className={field} />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={saving}
          className="rounded-full bg-goospe-gradient px-6 py-2.5 font-medium text-white shadow disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {msg && (
          <span
            role={msg.ok ? 'status' : 'alert'}
            className={`inline-flex items-center gap-1 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600'}`}
          >
            {msg.ok && <Check size={15} strokeWidth={2} />}{msg.text}
          </span>
        )}
      </div>
    </form>
  )
}
