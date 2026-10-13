import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertPlaceMembership, isAdmin } from '@/lib/ownership'
import { getPlace } from '@/features/places/place-data'
import { PlaceView } from '@/features/places/PlaceView'
import { isSlug, placePath } from '@/features/places/seo-routes'

// Vista previa de un lugar NO publicado, solo para su dueño (miembro del negocio) o un admin.
// La ficha pública de ese lugar responde 404; aquí se valida la sesión ANTES de leer nada con
// service role. Para cualquier otra persona esta ruta tampoco existe (404, no "sin permiso":
// no se confirma que el lugar exista).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Vista previa | Goospe',
  robots: { index: false, follow: false },
}

export default async function PlacePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isSlug(slug)) notFound()

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`${placePath(slug)}/preview`)}`)

  const place = await getPlace(slug)
  if (!place) notFound()
  const allowed = (await isAdmin(user.id)) || !!(await assertPlaceMembership(user.id, place.id))
  if (!allowed) notFound()
  // Publicado: la vista previa no aporta nada, se manda a la ficha real.
  if (place.is_published === true) redirect(placePath(place.slug))

  return <PlaceView place={place} preview />
}
