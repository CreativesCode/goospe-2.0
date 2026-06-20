import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { isLocalhostRequest } from '@/lib/local-only'
import { LoaderClient } from '@/features/loader/components/LoaderClient'

export const metadata: Metadata = { title: 'Cargador de zonas' }

// Local-only de verdad: en cualquier deploy que no sea localhost, la ruta no existe (404).
export default async function LoaderPage() {
  if (!(await isLocalhostRequest())) notFound()

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight text-fg">Cargador de zonas</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-soft">
        Solo local. Carga una ciudad nueva de punta a punta (OSM → fotos → enriquecimiento IA por
        niveles) y la activa en el feed al terminar. El proceso corre en tu máquina; sigue el
        progreso en vivo aquí abajo.
      </p>
      <div className="mt-5">
        <LoaderClient />
      </div>
    </div>
  )
}
