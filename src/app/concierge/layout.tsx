import type { Metadata } from 'next'

// /concierge es client component y no puede exportar `metadata`; este layout aporta el SEO.
export const metadata: Metadata = {
  title: 'Decídeme — el conserje IA de Goospe',
  description:
    'Escribe qué buscas y el conserje IA de Goospe te da 3 lugares cerca de ti con el porqué de cada uno. Decidido en 30 segundos.',
  alternates: { canonical: '/concierge' },
}

export default function ConciergeLayout({ children }: { children: React.ReactNode }) {
  return children
}
