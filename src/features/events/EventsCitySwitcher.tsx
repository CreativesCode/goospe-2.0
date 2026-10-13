'use client'

import { useRouter } from 'next/navigation'
import { CitySwitcher } from '@/features/city/CitySwitcher'
import { eventsHref } from './event-params'
import type { EventWindow } from './event-time'

/**
 * Selector de ciudad de la cartelera. Elegir una ciudad la guarda como ciudad del visitante
 * (igual que en el feed) y navega a `?city=<slug>`; "Cerca de mí" la quita y vuelve a la
 * cartelera sin ciudad (todas). `current` es la ciudad que muestra la página (la de la URL o,
 * sin `?city=`, la elegida), no necesariamente la guardada en el dispositivo.
 */
export function EventsCitySwitcher({ current, when }: { current: { id: number; name: string } | null; when: EventWindow }) {
  const router = useRouter()
  return (
    <CitySwitcher
      label="Todas las ciudades"
      current={current}
      onChange={(city) => {
        const href = eventsHref(when, city?.slug ?? null)
        // Misma URL (p. ej. se quitó la ciudad estando en /events): hay que volver a pedirla,
        // porque la respuesta depende de la cookie.
        if (href === `${window.location.pathname}${window.location.search}`) router.refresh()
        else router.push(href, { scroll: false })
      }}
    />
  )
}
