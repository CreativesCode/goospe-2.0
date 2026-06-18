'use client'

import Link from 'next/link'
import { RefreshCw, Home } from 'lucide-react'

/**
 * Boundary de error a nivel de app: captura errores de render de cualquier ruta
 * y muestra un mensaje amigable en español con reintento, en vez de una pantalla rota.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-90" />
      <div>
        <h1 className="text-2xl font-medium text-fg">Algo salió mal</h1>
        <p className="mt-2 max-w-sm text-fg-soft">
          Tuvimos un problema al cargar esta página. Vuelve a intentarlo en un momento.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-goospe-green px-5 py-2.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
        >
          <RefreshCw size={16} strokeWidth={2} /> Reintentar
        </button>
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-fg-soft transition hover:text-fg"
        >
          <Home size={16} strokeWidth={2} /> Ir al inicio
        </Link>
      </div>
    </main>
  )
}
