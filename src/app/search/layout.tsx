import type { Metadata } from 'next'

// /search es client component y no puede exportar `metadata`; este layout aporta el SEO.
export const metadata: Metadata = {
  title: 'Buscar lugares cerca de ti | Goospe',
  description:
    'Encuentra cafés, restaurantes, bares y panoramas cerca de ti. Filtra por categoría, precio y abierto ahora.',
  alternates: { canonical: '/search' },
}

export default function BuscarLayout({ children }: { children: React.ReactNode }) {
  return children
}
