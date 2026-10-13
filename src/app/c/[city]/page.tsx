import type { Metadata } from 'next'
import { CityListing, listingMetadata, resolveListing } from '@/features/places/CityListing'

// Listado SEO de una ciudad: /c/[ciudad]. ISR de 1 h, generado bajo demanda (no se
// prerrenderiza en el build: `generateStaticParams` vacío solo activa la caché por ruta).
export const revalidate = 3600
export const generateStaticParams = async () => []

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  return listingMetadata(await resolveListing(city, null), 1)
}

export default async function CityPage({ params }: Props) {
  const { city } = await params
  return <CityListing target={await resolveListing(city, null)} page={1} />
}
