'use client'

import { useEffect, useState } from 'react'
import { getActiveCities, type ActiveCity } from '../services/coverage'
import { WaitlistForm } from './WaitlistForm'

// Pantalla "aún no llegamos a tu zona": se muestra cuando el usuario está fuera de toda
// ciudad activa. Bloquea el feed, explica que estamos creciendo y captura waitlist.
export function OutOfCoverageScreen({ coords }: { coords?: { lat: number; lng: number } }) {
  const [cities, setCities] = useState<ActiveCity[]>([])

  useEffect(() => {
    getActiveCities()
      .then(setCities)
      .catch(() => setCities([]))
  }, [])

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-goospe-gradient px-6 pt-[var(--sat)] pb-[var(--sab)] text-center text-white">
      <img src="/brand/isotipo-white.svg" alt="" className="h-16 w-16" />

      <h1 className="mt-7 text-3xl font-light leading-tight tracking-tight sm:text-4xl">
        Aún no llegamos a <span className="font-medium">tu zona</span>
      </h1>
      <p className="mt-4 max-w-md text-base text-white/90 sm:text-lg">
        Goospe está creciendo. Déjanos tu correo y te avisamos apenas estemos en tu ciudad
        con los mejores lugares cerca de ti.
      </p>

      <div className="mt-8 w-full max-w-sm">
        <WaitlistForm coords={coords} />
      </div>

      {cities.length > 0 && (
        <div className="mt-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
            Por ahora estamos en
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {cities.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur"
              >
                {c.name}, {c.country}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
