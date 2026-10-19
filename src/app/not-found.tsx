import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Página no encontrada | Goospe',
  robots: { index: false },
}

// 404 de marca y en español (antes salía el genérico de Next en inglés). Lo usan las rutas
// inexistentes y cualquier `notFound()` (p. ej. una ficha de lugar que ya no existe).
export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <img src="/brand/isotipo-color.svg" alt="Goospe" className="h-14 w-14" />
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.08em] text-ink">Error 404</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight text-fg">
          Aquí no hay <span className="font-medium">nada</span>
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-fg-soft">
          La página que buscas no existe o cambió de dirección. Sigamos buscando a dónde ir hoy.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 rounded-full bg-goospe-gradient px-6 py-2.5 text-sm font-medium text-on-brand shadow"
        >
          <Compass size={16} strokeWidth={1.75} /> Explorar lugares
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-6 py-2.5 text-sm font-medium text-fg-soft transition hover:text-fg"
        >
          <Search size={16} strokeWidth={1.75} /> Buscar
        </Link>
      </div>
    </main>
  )
}
