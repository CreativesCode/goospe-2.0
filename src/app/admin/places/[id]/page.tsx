import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPlaceForm, type AdminPlace } from '@/features/admin/AdminPlaceForm'
import { requireAdmin } from '@/lib/admin-guard'
import { adminTitle } from '@/features/admin/ui'

export const metadata: Metadata = { title: 'Editar lugar' }

export const dynamic = 'force-dynamic'

export default async function EditarLugarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin(`/admin/places/${id}`) // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()

  const [{ data: place }, { data: cats }, { data: cityRows }, { data: coords }] = await Promise.all([
    admin.from('places')
      .select('id, city_id, name, slug, description, vibe_line, phone, whatsapp, website, instagram, email, price_level, tags, is_published, place_categories(category_id)')
      .eq('id', id).maybeSingle(),
    admin.from('categories').select('id, name').order('name'),
    admin.from('cities').select('id, name, is_active').order('name'),
    admin.rpc('places_lnglat', { ids: [id] }),
  ])
  if (!place) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = place as any
  const ll = (coords as { lat: number | null; lng: number | null }[] | null)?.[0]

  const initial: AdminPlace = {
    id: p.id, name: p.name, slug: p.slug, description: p.description, vibe_line: p.vibe_line,
    phone: p.phone, whatsapp: p.whatsapp, website: p.website, instagram: p.instagram, email: p.email,
    price_level: p.price_level, tags: p.tags, is_published: p.is_published,
    lat: ll?.lat ?? null, lng: ll?.lng ?? null,
    city_id: p.city_id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category_ids: (p.place_categories ?? []).map((pc: any) => pc.category_id),
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/places" className="inline-flex items-center gap-1.5 text-sm text-fg-soft hover:text-fg">
        <ArrowLeft size={15} /> Volver a lugares
      </Link>
      <h1 className={`${adminTitle}`}><span className="font-medium">{p.name}</span></h1>
      <AdminPlaceForm
        place={initial}
        categories={(cats ?? []) as { id: number; name: string }[]}
        cities={(cityRows ?? []) as { id: number; name: string; is_active: boolean | null }[]}
      />
    </div>
  )
}
