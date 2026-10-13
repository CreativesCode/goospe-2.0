'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { filterCities, groupByCountry, type ActiveCity } from '@/lib/city-choice'
import { fetchActiveCities, setCityChoice, useCityChoice } from './city-store'

const TRIGGER: Record<'dark' | 'light' | 'inline', string> = {
  // Sobre la foto del feed móvil (overlay oscuro).
  dark: 'pointer-events-auto inline-flex max-w-[52vw] items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20',
  // Chip claro (tablet, buscador).
  light: 'inline-flex max-w-[60vw] items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-fg transition hover:border-goospe-green/50',
  // Texto con subrayado (cabecera del feed web).
  inline: 'inline-flex items-center gap-1 text-sm text-muted underline-offset-4 transition hover:text-fg hover:underline',
}

/**
 * Selector de ciudad: chip con la ubicación actual que abre un diálogo con buscador, la opción
 * "Cerca de mí" y las ciudades activas. Elegir una ciudad sustituye a la geolocalización en toda
 * la app (feed, eventos, buscador, conserje) y se recuerda en el dispositivo; "Cerca de mí" la
 * quita. El cambio se emite por `city-store`; quien dependa de la ubicación escucha `CITY_EVENT`.
 *
 * `label`: texto del chip cuando NO hay ciudad elegida (p. ej. la ciudad detectada por GPS).
 * `current`: ciudad a mostrar en vez de la guardada (el buscador muestra la de su URL, que en un
 * enlace compartido puede no ser la del dispositivo). undefined = usar la guardada.
 */
export function CitySwitcher({
  label = 'Cerca de mí',
  variant = 'light',
  className = '',
  current,
  onChange,
}: {
  label?: string
  variant?: 'dark' | 'light' | 'inline'
  className?: string
  current?: { id: number; name: string } | null
  /** Aviso opcional tras elegir (la ciudad, o null si volvió a "cerca de mí"). */
  onChange?: (city: ActiveCity | null) => void
}) {
  const stored = useCityChoice()
  const chosen = current === undefined ? stored : current
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Cambiar de ciudad. Ahora: ${chosen?.name ?? label}`}
        className={`${TRIGGER[variant]} ${className}`}
      >
        <MapPin size={variant === 'light' ? 15 : 13} strokeWidth={2} className={variant === 'dark' ? 'shrink-0 text-goospe-green-light' : 'shrink-0 text-goospe-green'} />
        <span className="min-w-0 truncate">{chosen?.name ?? label}</span>
        <ChevronDown size={variant === 'light' ? 14 : 12} strokeWidth={2.25} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <CityDialog
          chosenId={chosen?.id ?? null}
          onClose={() => setOpen(false)}
          onPick={(city) => {
            setCityChoice(city)
            setOpen(false)
            onChange?.(city)
          }}
        />
      )}
    </>
  )
}

function CityDialog({
  chosenId,
  onClose,
  onPick,
}: {
  chosenId: number | null
  onClose: () => void
  onPick: (city: ActiveCity | null) => void
}) {
  const [cities, setCities] = useState<ActiveCity[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    fetchActiveCities()
      .then((list) => { if (alive) { setCities(list); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attempt])

  // Escape cierra; el fondo no hace scroll mientras el diálogo está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const groups = useMemo(() => groupByCountry(filterCities(cities ?? [], q)), [cities, q])
  const none = cities !== null && groups.length === 0

  // Portal a <body>: el chip vive dentro de cabeceras con `pointer-events-none`, `backdrop-blur`
  // o `overflow-hidden`, que recortarían o desactivarían un diálogo anidado.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-dialog-title"
        className="relative flex h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-card text-fg shadow-2xl sm:h-[560px] sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 id="city-dialog-title" className="text-lg font-medium">¿Dónde quieres explorar?</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-fg">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Busca una ciudad…"
              aria-label="Buscar ciudad"
              autoComplete="off"
              className="w-full rounded-full border border-line bg-surface py-2 pl-10 pr-4 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-pressed={chosenId === null}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-surface"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
              <LocateFixed size={17} strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Cerca de mí</span>
              <span className="block text-xs text-muted">Usa la ubicación de este dispositivo</span>
            </span>
            {chosenId === null && <Check size={17} strokeWidth={2.25} className="shrink-0 text-goospe-green" />}
          </button>

          {cities === null && !failed && (
            <ul aria-hidden className="mt-2 space-y-2 px-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className="h-10 animate-pulse rounded-xl bg-surface" />)}
            </ul>
          )}
          {failed && (
            <div className="px-3 py-8 text-center text-sm text-fg-soft">
              <p>No pudimos cargar las ciudades.</p>
              <button type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1) }} className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm font-medium transition hover:text-fg">
                Reintentar
              </button>
            </div>
          )}
          {none && <p className="px-3 py-8 text-center text-sm text-muted">Aún no estamos en “{q.trim()}”.</p>}

          {groups.map((g) => (
            <section key={g.country} className="mt-3">
              <h3 className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{g.country}</h3>
              <ul>
                {g.cities.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      aria-pressed={chosenId === c.id}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {[c.region, `${c.places} ${c.places === 1 ? 'lugar' : 'lugares'}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {chosenId === c.id && <Check size={17} strokeWidth={2.25} className="shrink-0 text-goospe-green" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
