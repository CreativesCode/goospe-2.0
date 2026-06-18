import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPlaceForm, type AdminPlace } from '@/features/admin/AdminPlaceForm'

export const dynamic = 'force-dynamic'

export default async function EditarLugarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: place }, { data: cats }, { data: coords }] = await Promise.all([
    admin.from('places')
      .select('id, name, slug, description, vibe_line, phone, whatsapp, website, instagram, email, price_level, tags, is_published, place_categories(category_id)')
      .eq('id', id).maybeSingle(),
    admin.from('categories').select('id, name').order('name'),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category_ids: (p.place_categories ?? []).map((pc: any) => pc.category_id),
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/places" className="inline-flex items-center gap-1.5 text-sm text-fg-soft hover:text-fg">
        <ArrowLeft size={15} /> Volver a lugares
      </Link>
      <h1 className="text-2xl font-medium text-fg">{p.name}</h1>
      <AdminPlaceForm place={initial} categories={(cats ?? []) as { id: number; name: string }[]} />
    </div>
  )
}
