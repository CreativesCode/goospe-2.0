'use client'

import Link from 'next/link'
import { Heart, Star } from 'lucide-react'
import { categoryIcon } from '@/shared/lib/icons'
import { PhotoImg } from '@/shared/components/photo-img'
import { OpenNowBadge } from '@/features/places/OpenNowBadge'

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
  /** Estado ya calculado (buscador). Si no viene, se calcula en el navegador con `hours`. */
  open_now?: boolean | null
  hours?: { osm_raw?: string | null } | null
  timezone?: string | null
  vibe_line?: string | null
}

type PlaceCardProps = {
  place: PlaceCardData
  /** `card`: columna con la foto arriba. `row`: foto de 96 px a la izquierda, sin corazón. */
  layout?: 'card' | 'row'
  /** Posición en un ranking (conserje): círculo numerado en lugar del badge "Abierto". */
  rank?: number
  /** Razón IA del conserje: sustituye a vibe_line, mostrada entre comillas. */
  reason?: string
  /** Clase de alto de la foto en `card` (por defecto 168 px). */
  imgClassName?: string
  /** Estado del corazón. Sin esta prop no se pinta (la vista no conoce los guardados). */
  saved?: boolean
  /** Con ella el corazón es un botón; sin ella, solo un indicador. */
  onToggleSave?: () => void
  /** Sustituye la navegación a la ficha (p. ej. saltar a esa tarjeta en el mazo del feed). */
  onOpen?: () => void
}

const fmtDist = (m: number | null | undefined) =>
  m == null ? '' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`

/**
 * Tarjeta de lugar compartida (buscador, guardados, listados por ciudad, relacionados, "lo que
 * sigue" del feed). Sin foto: fondo `tint` + icono de la categoría.
 * La foto y el cuerpo enlazan a la ficha; el corazón va fuera del enlace para no anidar
 * elementos interactivos.
 */
export function PlaceCard({
  place: p,
  layout = 'card',
  rank,
  reason,
  imgClassName = 'h-[168px]',
  saved,
  onToggleSave,
  onOpen,
}: PlaceCardProps) {
  const Cat = categoryIcon(p.category_emoji)
  const row = layout === 'row'
  const line = reason ? `“${reason}”` : p.vibe_line
  const dist = fmtDist(p.distance_m)

  const body = (
    <>
      <div className={`relative shrink-0 overflow-hidden ${row ? 'w-24 self-stretch' : imgClassName}`}>
        <PhotoImg
          src={p.photo_url}
          alt={p.name}
          className={`h-full w-full object-cover ${row ? 'min-h-24' : ''}`}
          fallback={<Cat size={row ? 26 : 40} strokeWidth={1.5} />}
        />
        {!row && rank != null && (
          <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#1C1C1A] text-[13px] font-medium text-white">
            {rank}
          </span>
        )}
        {!row && rank == null && (
          p.open_now === true ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-goospe-green px-[9px] py-1 text-[11px] font-medium leading-none text-on-brand">Abierto</span>
          ) : p.open_now == null && p.hours ? (
            <OpenNowBadge hours={p.hours} timezone={p.timezone} onlyOpen short className="absolute left-2.5 top-2.5" />
          ) : null
        )}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-[3px] ${row ? 'px-3.5 py-3' : 'px-4 pb-4 pt-3.5'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-medium leading-tight text-fg ${row ? 'text-[15px]' : 'text-base'}`}>{p.name}</span>
          {p.price_level ? <span className="shrink-0 text-[13px] text-muted">{'$'.repeat(p.price_level)}</span> : null}
        </div>
        {line && <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">{line}</span>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5 text-xs text-muted">
          <Cat size={12} strokeWidth={1.75} className="shrink-0" />
          {p.category_name && <span>{p.category_name}</span>}
          {dist && <><span>·</span><span>{dist}</span></>}
          {p.rating != null && p.rating > 0 && (
            <><span>·</span><Star size={12} strokeWidth={1.75} fill="currentColor" className="shrink-0" /><span>{Number(p.rating).toFixed(1)}</span></>
          )}
        </div>
      </div>
    </>
  )

  const shell = `flex h-full w-full text-left ${row ? 'flex-row' : 'flex-col'}`

  return (
    <div className="group relative h-full overflow-hidden rounded-[20px] border border-line bg-card transition hover:border-goospe-green/40">
      {onOpen ? (
        <button type="button" onClick={onOpen} className={shell}>{body}</button>
      ) : (
        <Link href={`/places/${p.slug}`} className={shell}>{body}</Link>
      )}
      {!row && saved !== undefined && (
        onToggleSave ? (
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? `Quitar ${p.name} de guardados` : `Guardar ${p.name}`}
            className={`absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full backdrop-blur-[6px] transition before:absolute before:-inset-1.5 before:content-[''] ${saved ? 'bg-goospe-green text-on-brand' : 'bg-[rgba(28,28,26,0.42)] text-white'}`}
          >
            <Heart size={15} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
          </button>
        ) : (
          <span aria-hidden className={`pointer-events-none absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full backdrop-blur-[6px] ${saved ? 'bg-goospe-green text-on-brand' : 'bg-[rgba(28,28,26,0.42)] text-white'}`}>
            <Heart size={15} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
          </span>
        )
      )}
    </div>
  )
}
