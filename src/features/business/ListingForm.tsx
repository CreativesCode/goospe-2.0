'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { updateListing } from '@/actions/business'
import { Chip } from '@/shared/components/chip'
import { toast } from '@/shared/components/toast'
import { categoryIcon } from '@/shared/lib/icons'
import { HoursEditor } from '@/features/business/HoursEditor'
import { MAX_CATEGORIES } from '@/features/business/owner-schemas'
import { fieldClass, hintClass, labelClass, primaryBtn } from '@/features/business/ui'

export type ListingPlace = {
  id: string
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  email: string | null
  price_level: number | null
  tags: string[] | null
  address: { street?: string | null; number?: string | null; city?: string | null } | null
  hoursRaw: string | null
  categoryIds: number[]
}
export type CategoryOption = { id: number; name: string; emoji: string | null }

const group = 'space-y-4 border-t border-line pt-5 first:border-0 first:pt-0'
const legend = 'text-xs font-medium uppercase tracking-[0.08em] text-muted'

function CategoryPicker({ options, initial }: { options: CategoryOption[]; initial: number[] }) {
  const [selected, setSelected] = useState<number[]>(initial)
  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_CATEGORIES ? cur : [...cur, id]))
  return (
    <div>
      <input type="hidden" name="category_ids" value={selected.join(',')} />
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <Chip key={c.id} label={c.name} icon={categoryIcon(c.emoji)} active={selected.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <p className={`mt-2 ${hintClass}`}>Elige entre 1 y {MAX_CATEGORIES}.</p>
    </div>
  )
}

export function ListingForm({ place, categories }: { place: ListingPlace; categories: CategoryOption[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // onSubmit (no `<form action>`): React reinicia los campos no controlados al terminar una
  // acción, así que un error de validación del servidor borraba lo que el dueño había escrito.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaving(true)
    setMsg(null)
    const res = await updateListing(formData)
    setSaving(false)
    if (res?.error) { setMsg({ ok: false, text: res.error }); return }
    setMsg({ ok: true, text: 'Cambios guardados' })
    toast.success('Ficha actualizada: ya se ve en tu página pública')
    router.refresh()
  }

  // El error deja de aplicar en cuanto el dueño toca algo (campos, chips o botones del horario).
  const clearError = () => setMsg((m) => (m && !m.ok ? null : m))

  return (
    <form onSubmit={onSubmit} onChange={clearError} className="space-y-5"
      onClick={(e) => { if ((e.target as HTMLElement).closest('button:not([type="submit"])')) clearError() }}>

      <section className={group}>
        <h3 className={legend}>Presentación</h3>
        <div>
          <label className={labelClass} htmlFor="vibe_line">Frase de identidad</label>
          <input id="vibe_line" name="vibe_line" defaultValue={place.vibe_line ?? ''} maxLength={160}
            placeholder="Ej: El mejor café de especialidad junto al lago" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="description">Descripción</label>
          <textarea id="description" name="description" defaultValue={place.description ?? ''} rows={4} maxLength={2000} className={fieldClass} />
        </div>
        <div>
          <span className={labelClass}>Categorías</span>
          <div className="mt-2"><CategoryPicker options={categories} initial={place.categoryIds} /></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="price_level">Rango de precio</label>
            <select id="price_level" name="price_level" defaultValue={place.price_level ?? ''} className={`${fieldClass} select-chevron`}>
              <option value="">Sin especificar</option>
              <option value="1">$ — económico</option>
              <option value="2">$$ — moderado</option>
              <option value="3">$$$ — alto</option>
              <option value="4">$$$$ — premium</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="tags">Etiquetas (separadas por coma)</label>
            <input id="tags" name="tags" defaultValue={(place.tags ?? []).join(', ')} placeholder="café, pet friendly, wifi" className={fieldClass} />
          </div>
        </div>
      </section>

      <section className={group}>
        <h3 className={legend}>Contacto</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="phone">Teléfono</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={place.phone ?? ''} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="whatsapp">WhatsApp</label>
            <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={place.whatsapp ?? ''} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">Email de contacto</label>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={place.email ?? ''} placeholder="hola@tunegocio.cl" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="website">Sitio web</label>
            <input id="website" name="website" type="url" inputMode="url" autoComplete="url" placeholder="https://…" defaultValue={place.website ?? ''} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="instagram">Instagram</label>
            <input id="instagram" name="instagram" defaultValue={place.instagram ?? ''} placeholder="@tunegocio" className={fieldClass} />
          </div>
        </div>
      </section>

      <section className={group}>
        <h3 className={legend}>Dirección</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass} htmlFor="street">Calle</label>
            <input id="street" name="street" autoComplete="address-line1" maxLength={120} defaultValue={place.address?.street ?? ''} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="street_number">Número</label>
            <input id="street_number" name="street_number" maxLength={20} defaultValue={place.address?.number ?? ''} className={fieldClass} />
          </div>
        </div>
        {place.address?.city && <p className={hintClass}>Ciudad: {place.address.city}. El pin del mapa se cambia desde “Nombre y ubicación”.</p>}
      </section>

      <section className={group}>
        <h3 className={legend}>Horario</h3>
        <HoursEditor initialRaw={place.hoursRaw} />
      </section>

      {/* Barra de guardado siempre a mano en móvil (el formulario es largo). */}
      <div className="sticky bottom-[calc(4rem+var(--sab))] z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0">
        <input type="hidden" name="place_id" value={place.id} />
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {msg && (
          <span role={msg.ok ? 'status' : 'alert'}
            className={`inline-flex items-center gap-1 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600 dark:text-red-400'}`}>
            {msg.ok && <Check size={15} strokeWidth={2} />}{msg.text}
          </span>
        )}
      </div>
    </form>
  )
}
