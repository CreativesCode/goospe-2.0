import type { Metadata } from 'next'

// /feed es client component y no puede exportar `metadata`; este layout aporta el SEO.
export const metadata: Metadata = {
  title: 'Feed — lugares cerca de ti en Puerto Varas | Goospe',
  description:
    'Descubre lugares de Puerto Varas en un feed con foto, vibe, precio y distancia. Guarda, pide cómo llegar o comparte.',
  alternates: { canonical: '/feed' },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children
}
