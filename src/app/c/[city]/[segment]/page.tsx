import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityListing, listingMetadata, resolveListing } from '@/features/places/CityListing'
import { parsePageSegment } from '@/lib/pagination'

// /c/[ciudad]/[segmento]: el segmento es una CATEGORÍA ("comer") o, si es un número, la página
// N del listado de la ciudad ("/c/granada-es/2"). Un slug de categoría nunca es solo dígitos.
export const revalidate = 3600
export const generateStaticParams = async () => []

type Props = { params: Promise<{ city: string; segment: string }> }

async function resolve({ params }: Props) {
  const { city, segment } = await params
  const page = parsePageSegment(segment)
  // La página 1 solo existe en la ruta limpia: "/c/x/1" es 404, no un duplicado.
  if (page === 1) notFound()
  return { target: await resolveListing(city, page === null ? segment : null), page: page ?? 1 }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { target, page } = await resolve(props)
  return listingMetadata(target, page)
}

export default async function CitySegmentPage(props: Props) {
  const { target, page } = await resolve(props)
  return <CityListing target={target} page={page} />
}
