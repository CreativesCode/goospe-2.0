import type { Metadata } from 'next'

// /buscar es client component y no puede exportar `metadata`; este layout aporta el SEO.
export const metadata: Metadata = {
  title: 'Buscar lugares en Puerto Varas | Goospe',
  description:
    'Encuentra cafés, restaurantes, bares y panoramas en Puerto Varas. Filtra por categoría, precio y abierto ahora.',
  alternates: { canonical: '/buscar' },
}

export default function BuscarLayout({ children }: { children: React.ReactNode }) {
  return children
}
