import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPlaceForm, type AdminPlace } from '@/features/admin/AdminPlaceForm'

export const dynamic = 'force-dynamic'

const EMPTY: AdminPlace = {
  id: null, name: '', slug: '', description: null, vibe_line: null,
  phone: null, whatsapp: null, website: null, instagram: null, email: null,
  price_level: null, tags: null, is_published: false, lat: null, lng: null, category_ids: [],
}

export default async function NuevoLugarPage() {
  const admin = createAdminClient()
  const { data: cats } = await admin.from('categories').select('id, name').order('name')

  return (
    <div className="space-y-5">
      <Link href="/admin/places" className="inline-flex items-center gap-1.5 text-sm text-fg-soft hover:text-fg">
        <ArrowLeft size={15} /> Volver a lugares
      </Link>
      <h1 className="text-2xl font-medium text-fg">Nuevo lugar</h1>
      <AdminPlaceForm place={EMPTY} categories={(cats ?? []) as { id: number; name: string }[]} />
    </div>
  )
}
