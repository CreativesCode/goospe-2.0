'use client'

import { MapPin } from 'lucide-react'
import { CitySwitcher } from '@/features/city/CitySwitcher'

// Pantalla "activa tu ubicación": se muestra cuando NO pudimos obtener la ubicación real del
// usuario (permiso denegado / timeout / navegador sin geolocalización). En vez de mostrar
// el centro por defecto a ciegas, pedimos activar la ubicación para descubrir lugares realmente cerca.
// - onEnable   : reintenta la geolocalización (útil si el usuario acaba de conceder el permiso).
// - onContinue : escape para explorar sin ubicación exacta (usa el centro de la ciudad activa).
export function LocationNeededScreen({
  onEnable,
  onContinue,
}: {
  onEnable: () => void
  onContinue: () => void
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-goospe-gradient px-6 pt-[var(--sat)] pb-[var(--sab)] text-center text-on-brand">
      <img src="/brand/isotipo-white.svg" alt="" className="h-16 w-16" />

      <h1 className="mt-7 text-3xl font-light leading-tight tracking-tight sm:text-4xl">
        Activa tu <span className="font-medium">ubicación</span>
      </h1>
      <p className="mt-4 max-w-md text-base text-white/90 sm:text-lg">
        Para mostrarte los mejores lugares cerca de ti, Goospe necesita saber dónde estás.
        Actívala y descubre qué hay a tu alrededor.
      </p>

      <button
        onClick={onEnable}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-medium text-ink shadow-lg transition hover:bg-white/90"
      >
        <MapPin size={18} strokeWidth={2} /> Activar mi ubicación
      </button>

      <button
        onClick={onContinue}
        className="mt-4 text-sm font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
      >
        Explorar de todos modos
      </button>

      {/* Salida sin geolocalización: elegir una ciudad a mano (el feed se recarga solo). */}
      <CitySwitcher variant="dark" label="Elegir una ciudad" className="mt-6 !max-w-none !px-4 !py-2 !text-sm" />

      <p className="mt-10 max-w-xs text-xs text-white/60">
        Si ya la bloqueaste, actívala desde el candado 🔒 de la barra de direcciones y vuelve a
        tocar “Activar mi ubicación”.
      </p>
    </main>
  )
}
