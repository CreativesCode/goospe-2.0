'use client'

import { RefreshCw } from 'lucide-react'

// Pantalla "muy pronto en tu zona": el usuario SÍ está dentro de una ciudad activa, pero el feed
// no trae lugares ni eventos todavía (zona recién activada / sin datos cargados). Evita mostrar un
// feed en blanco. Distinto de <OutOfCoverageScreen> (ese es "fuera de toda cobertura").
export function ComingSoonScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-goospe-gradient px-6 pt-[var(--sat)] pb-[var(--sab)] text-center text-white">
      <img src="/brand/isotipo-white.svg" alt="" className="h-16 w-16" />

      <h1 className="mt-7 text-3xl font-light leading-tight tracking-tight sm:text-4xl">
        Muy pronto en <span className="font-medium">tu zona</span>
      </h1>
      <p className="mt-4 max-w-md text-base text-white/90 sm:text-lg">
        Ya estamos en tu ciudad y sumando los mejores lugares cerca de ti. Vuelve en un rato:
        esto se va a llenar de planes.
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90"
        >
          <RefreshCw size={18} strokeWidth={2} /> Actualizar
        </button>
      )}
    </main>
  )
}
