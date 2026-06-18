'use client'

import Link from 'next/link'
import { Star, MapPin, Compass } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'

export type PlaceCardData = {
  id: string
  slug: string
  name: string
  photo_url: string | null
  category_name: string | null
  category_emoji?: string | null
  price_level: number | null
  distance_m?: number | null
  rating?: number
  open_now?: boolean | null
  vibe_line?: string | null
}

type PlaceCardProps = {
  place: PlaceCardData
  /** Posición en un ranking (conserje): muestra un badge numerado sobre la foto. */
  rank?: number
  /** Razón IA del conserje: sustituye a vibe_line, mostrada entre comillas. */
  reason?: string
  /** Acción "Cómo llego" (conserje): pie con enlace a Google Maps. */
  directions?: { lat: number; lng: number; onClick?: () => void }
}

const fmtDist = (m: number | null | undefined) =>
  m == null ? '' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`

/**
 * Card de lugar reutilizable (feed de búsqueda, conserje, etc.).
 * Foto 4:3 arriba + nombre, vibe/razón, categoría · distancia · rating.
 * La foto + el cuerpo enlazan a la ficha; las acciones (Cómo llego) van fuera
 * del <Link> para no anidar <a> dentro de <a>.
 */
export function PlaceCard({ place: p, rank, reason, directions }: PlaceCardProps) {
  const Cat = categoryIcon(p.category_emoji)

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md">
      <Link href={`/places/${p.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-goospe-gradient text-white">
              <Cat size={44} strokeWidth={1.5} />
            </div>
          )}
          {rank != null && (
            <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-goospe-green text-xs font-bold text-white shadow">
              {rank}
            </span>
          )}
          {p.open_now === true && (
            <span className="absolute right-2 top-2 rounded-full bg-goospe-green px-2 py-0.5 text-[10px] font-medium text-white shadow">Abierto</span>
          )}
        </div>
        <div className="space-y-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium leading-tight text-fg">{p.name}</h2>
            {p.price_level ? <span className="shrink-0 text-sm text-muted">{'$'.repeat(p.price_level)}</span> : null}
          </div>
          {reason ? (
            <p className="text-sm font-medium text-goospe-green-dark">“{reason}”</p>
          ) : p.vibe_line ? (
            <p className="text-sm font-medium text-goospe-green">{p.vibe_line}</p>
          ) : null}
          <p className="flex items-center gap-2 pt-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Cat size={13} strokeWidth={1.75} /> {p.category_name}</span>
            {p.distance_m != null && <><span>·</span><span className="inline-flex items-center gap-1"><MapPin size={12} strokeWidth={1.75} /> {fmtDist(p.distance_m)}</span></>}
            {p.rating != null && p.rating > 0 && <><span>·</span><span className="inline-flex items-center gap-1"><Star size={12} strokeWidth={1.75} fill="currentColor" /> {Number(p.rating).toFixed(1)}</span></>}
          </p>
        </div>
      </Link>

      {directions && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${directions.lat},${directions.lng}`}
          target="_blank"
          rel="noreferrer"
          onClick={directions.onClick}
          className="mt-auto flex items-center gap-1.5 border-t border-line px-4 py-3 text-sm font-medium text-goospe-green transition hover:bg-goospe-green/5"
        >
          <Compass size={15} strokeWidth={1.75} /> Cómo llego
        </a>
      )}
    </div>
  )
}
