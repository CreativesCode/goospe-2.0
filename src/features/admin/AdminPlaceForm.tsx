'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { saveAdminPlace } from '@/actions/admin-places'

export type AdminPlace = {
  id: string | null
  name: string
  slug: string
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  email: string | null
  price_level: number | null
  tags: string[] | null
  is_published: boolean | null
  lat: number | null
  lng: number | null
  category_ids: number[]
}

type Category = { id: number; name: string }

const field = 'mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30'
const lbl = 'block text-sm font-medium text-fg'

export function AdminPlaceForm({ place, categories }: { place: AdminPlace; categories: Category[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const isNew = !place.id

  async function onSubmit(formData: FormData) {
    setSaving(true)
    setMsg(null)
    const res = await saveAdminPlace(formData)
    setSaving(false)
    if (res?.error) { setMsg({ ok: false, text: res.error }); return }
    setMsg({ ok: true, text: isNew ? 'Lugar creado' : 'Cambios guardados' })
    if (isNew && res?.id) router.push(`/admin/places/${res.id}`)
    else router.refresh()
  }

  return (
    <form action={onSubmit} className="space-y-6">
      {place.id && <input type="hidden" name="id" value={place.id} />}

      <section className="space-y-5 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Identidad</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="name">Nombre *</label>
            <input id="name" name="name" required defaultValue={place.name} className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="slug">Slug (URL)</label>
            <input id="slug" name="slug" defaultValue={place.slug} placeholder="se genera del nombre" className={field} />
          </div>
        </div>
        <div>
          <label className={lbl} htmlFor="vibe_line">Frase de identidad</label>
          <input id="vibe_line" name="vibe_line" defaultValue={place.vibe_line ?? ''} maxLength={80}
            placeholder="Ej: El mejor café de especialidad junto al lago" className={field} />
        </div>
        <div>
          <label className={lbl} htmlFor="description">Descripción</label>
          <textarea id="description" name="description" defaultValue={place.description ?? ''} rows={4} className={field} />
        </div>
        <div>
          <span className={lbl}>Categorías</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => {
              const checked = place.category_ids.includes(c.id)
              return (
                <label key={c.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-fg has-[:checked]:border-goospe-green has-[:checked]:bg-goospe-green/10 has-[:checked]:text-goospe-green-dark">
                  <input type="checkbox" name="category_ids" value={c.id} defaultChecked={checked} className="accent-goospe-green" />
                  {c.name}
                </label>
              )
            })}
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Contacto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={lbl} htmlFor="phone">Teléfono</label><input id="phone" name="phone" defaultValue={place.phone ?? ''} className={field} /></div>
          <div><label className={lbl} htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" defaultValue={place.whatsapp ?? ''} className={field} /></div>
          <div><label className={lbl} htmlFor="website">Sitio web</label><input id="website" name="website" defaultValue={place.website ?? ''} className={field} /></div>
          <div><label className={lbl} htmlFor="instagram">Instagram</label><input id="instagram" name="instagram" defaultValue={place.instagram ?? ''} placeholder="@tunegocio" className={field} /></div>
          <div><label className={lbl} htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={place.email ?? ''} className={field} /></div>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Detalles y ubicación</h2>
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
            <input id="tags" name="tags" defaultValue={(place.tags ?? []).join(', ')} placeholder="café, pet friendly, wifi" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="lat">Latitud</label>
            <input id="lat" name="lat" type="number" step="any" defaultValue={place.lat ?? ''} placeholder="-41.3195" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="lng">Longitud</label>
            <input id="lng" name="lng" type="number" step="any" defaultValue={place.lng ?? ''} placeholder="-72.9854" className={field} />
          </div>
        </div>
        <p className="text-xs text-muted">Si dejas las coordenadas vacías al crear, se usa el centro por defecto.</p>
      </section>

      <label className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
        <input type="checkbox" name="is_published" defaultChecked={!!place.is_published} className="h-4 w-4 accent-goospe-green" />
        <span className="text-sm font-medium text-fg">Publicado <span className="font-normal text-muted">— visible en feed, búsqueda y mapa</span></span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={saving}
          className="rounded-full bg-goospe-gradient px-6 py-2.5 font-medium text-white shadow disabled:opacity-60">
          {saving ? 'Guardando…' : isNew ? 'Crear lugar' : 'Guardar cambios'}
        </button>
        {place.slug && !isNew && (
          <Link href={`/places/${place.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-goospe-green hover:underline">
            Ver ficha pública <ExternalLink size={14} />
          </Link>
        )}
        {msg && (
          <span className={`inline-flex items-center gap-1 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600'}`}>
            {msg.ok && <Check size={15} strokeWidth={2} />}{msg.text}
          </span>
        )}
      </div>
    </form>
  )
}
