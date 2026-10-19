import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPlaceForm, type AdminPlace } from '@/features/admin/AdminPlaceForm'
import { requireAdmin } from '@/lib/admin-guard'
import { adminTitle } from '@/features/admin/ui'

export const metadata: Metadata = { title: 'Nuevo lugar' }

export const dynamic = 'force-dynamic'

const EMPTY: AdminPlace = {
  id: null, name: '', slug: '', description: null, vibe_line: null,
  phone: null, whatsapp: null, website: null, instagram: null, email: null,
  price_level: null, tags: null, is_published: false, lat: null, lng: null, category_ids: [],
}

export default async function NuevoLugarPage() {
  await requireAdmin('/admin/places/new') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()
  const [{ data: cats }, { data: cityRows }] = await Promise.all([
    admin.from('categories').select('id, name').order('name'),
    admin.from('cities').select('id, name, is_active').order('name'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/places" className="inline-flex items-center gap-1.5 text-sm text-fg-soft hover:text-fg">
        <ArrowLeft size={15} /> Volver a lugares
      </Link>
      <h1 className={`${adminTitle}`}>Nuevo <span className="font-medium">lugar</span></h1>
      <AdminPlaceForm
        place={EMPTY}
        categories={(cats ?? []) as { id: number; name: string }[]}
        cities={(cityRows ?? []) as { id: number; name: string; is_active: boolean | null }[]}
      />
    </div>
  )
}
