import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ListingForm } from '@/features/business/ListingForm'

export const dynamic = 'force-dynamic'

type PlaceEdit = {
  id: string
  slug: string
  name: string
  business_id: string | null
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  price_level: number | null
  tags: string[] | null
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ placeId: string }>
}) {
  const { placeId } = await params
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/panel/${placeId}`)

  const admin = createAdminClient()
  const { data } = await admin
    .from('places')
    .select('id, slug, name, business_id, description, vibe_line, phone, whatsapp, website, instagram, price_level, tags')
    .eq('id', placeId)
    .single()
  const place = data as unknown as PlaceEdit | null
  if (!place) notFound()

  // Verificar membresía: el usuario debe pertenecer al negocio dueño del place.
  let allowed = false
  if (place.business_id) {
    const { data: member } = await admin
      .from('business_members')
      .select('user_id')
      .eq('business_id', place.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    allowed = !!member
  }
  if (!allowed) redirect('/panel')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link href="/panel" className="text-goospe-gray/60 hover:text-goospe-gray">←</Link>
          <Link href="/feed"><img src="/brand/logo-color.svg" alt="Goospe" className="h-7" /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-goospe-gray">{place.name}</h1>
            <p className="text-sm text-goospe-gray/50">Edita cómo se ve tu ficha en Goospe</p>
          </div>
          <Link
            href={`/places/${place.slug}`}
            className="shrink-0 rounded-full border border-goospe-green/40 px-4 py-2 text-sm font-medium text-goospe-green-dark hover:bg-goospe-green/10"
          >
            Ver ficha pública →
          </Link>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <ListingForm place={place} />
        </div>
      </div>
    </main>
  )
}
