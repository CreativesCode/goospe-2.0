import type { Metadata } from 'next'

// /concierge es client component y no puede exportar `metadata`; este layout aporta el SEO.
export const metadata: Metadata = {
  title: 'Decídeme — el conserje IA de Goospe | Puerto Varas',
  description:
    'Escribe qué buscas y el conserje IA de Goospe te da 3 lugares en Puerto Varas con el porqué de cada uno. Decidido en 30 segundos.',
  alternates: { canonical: '/concierge' },
  openGraph: {
    title: 'Decídeme — el conserje IA de Goospe',
    description: 'Dinos qué buscas y te damos 3 lugares en Puerto Varas con su porqué. Decidido en 30 segundos.',
    url: '/concierge',
    type: 'website',
  },
}

export default function ConciergeLayout({ children }: { children: React.ReactNode }) {
  return children
}
