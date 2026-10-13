import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityListing, listingMetadata, resolveListing } from '@/features/places/CityListing'
import { parsePageSegment } from '@/lib/pagination'

// /c/[ciudad]/[categoria]/[página]: páginas 2 en adelante del listado de una categoría.
export const revalidate = 3600
export const generateStaticParams = async () => []

type Props = { params: Promise<{ city: string; segment: string; page: string }> }

async function resolve({ params }: Props) {
  const { city, segment, page: rawPage } = await params
  const page = parsePageSegment(rawPage)
  // Página no numérica, página 1 (vive en la ruta limpia) o "categoría" numérica → 404.
  if (page === null || page === 1 || parsePageSegment(segment) !== null) notFound()
  return { target: await resolveListing(city, segment), page }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { target, page } = await resolve(props)
  return listingMetadata(target, page)
}

export default async function CityCategoryPage(props: Props) {
  const { target, page } = await resolve(props)
  return <CityListing target={target} page={page} />
}
