import { createElement } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Sparkles } from 'lucide-react'
import { PhotoImg } from '@/shared/components/photo-img'
import { categoryIcon } from '@/shared/lib/icons'
import { landingContainer, type HeroPlace } from './landing-shared'

/**
 * Barra de prompt del hero. Es un formulario GET normal: abre /concierge?q=… también sin JS.
 * La píldora es blanca en ambos temas (va sobre el degradado), así que sus colores son fijos.
 */
function PromptBar() {
  return (
    <form
      action="/concierge"
      method="get"
      role="search"
      className="flex min-w-0 max-w-[560px] flex-[1_1_380px] items-center gap-1.5 rounded-full bg-white p-1.5 shadow-[0_20px_40px_-20px_rgba(11,42,29,0.5)] focus-within:ring-2 focus-within:ring-on-brand/40"
    >
      <Sparkles size={18} strokeWidth={1.75} className="ml-3.5 shrink-0 text-goospe-green-dark" aria-hidden />
      <input
        name="q"
        type="text"
        maxLength={300}
        autoComplete="off"
        enterKeyHint="go"
        aria-label="¿Qué plan buscas?"
        placeholder="algo chill y barato para 3…"
        className="h-[46px] min-w-0 flex-1 bg-transparent text-[15px] text-[#1C1C1A] outline-none placeholder:text-[#8C887F]"
      />
      <button
        type="submit"
        className="flex h-[46px] shrink-0 items-center gap-2 rounded-full bg-[#1C1C1A] px-5 text-[15px] font-medium text-white transition hover:bg-black"
      >
        Decídeme <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </button>
    </form>
  )
}

/** Tarjeta del carrusel: lugar real del feed. Sin distancia (no conocemos al visitante). */
function HeroCard({ place }: { place: HeroPlace }) {
  // createElement: el icono sale de un mapa estático, no es un componente creado en el render.
  const catIcon = createElement(categoryIcon(place.category_emoji), { size: 48, strokeWidth: 1.5 })
  const price = place.price_level ? '$'.repeat(place.price_level) : null
  const meta = [place.category_name, price].filter(Boolean).join(' · ')
  return (
    <Link
      href={`/places/${place.slug}`}
      className="group w-[240px] flex-none overflow-hidden rounded-3xl bg-card shadow-[0_24px_48px_-24px_rgba(11,42,29,0.5)] md:w-[280px]"
    >
      <PhotoImg
        src={place.photo_url}
        alt={place.name}
        className="h-[170px] w-full object-cover md:h-[210px]"
        fallback={catIcon}
      />
      <div className="px-4 pb-[18px] pt-3.5">
        {meta && <div className="text-xs text-muted">{meta}</div>}
        <div className="mt-[3px] truncate text-lg font-medium text-fg transition group-hover:text-ink">{place.name}</div>
        {place.vibe_line && <div className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">{place.vibe_line}</div>}
      </div>
    </Link>
  )
}

/**
 * Carrusel que sangra a la derecha y sobresale 64 px por debajo del hero. Tiene scroll horizontal
 * propio, así que no ensancha la página. El padding inferior deja sitio a la sombra (un contenedor
 * con scroll la recortaría) y el margen negativo lo compensa para no alargar el degradado.
 */
function HeroCarousel({ places }: { places: HeroPlace[] }) {
  return (
    <div
      aria-label="Lugares en Goospe"
      className="no-scrollbar -mb-12 -mr-5 mt-14 flex translate-y-16 gap-4 overflow-x-auto overscroll-x-contain pb-12 pr-5 md:-mr-8 md:pr-8"
    >
      {places.map((p) => (
        <HeroCard key={p.slug} place={p} />
      ))}
    </div>
  )
}

/**
 * Hero a sangre con el degradado de marca (igual en ambos temas). Sin lugares para el carrusel
 * (RPC caída o zona vacía) cierra con su propio padding y no deja el espaciador de 96 px.
 */
export function LandingHero({ eyebrow, places }: { eyebrow: string; places: HeroPlace[] }) {
  const hasCards = places.length > 0
  return (
    <>
      <section className="relative bg-goospe-gradient text-on-brand">
        {/* El isotipo se recorta en su propia capa: la sección no puede recortar, el carrusel sobresale. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <img src="/brand/isotipo-white.svg" alt="" className="absolute right-[-8%] top-[-12%] w-[58%] max-w-[720px] opacity-[0.16]" />
        </div>
        <div className={`${landingContainer} relative pt-10 md:pt-[72px] ${hasCards ? '' : 'pb-14 md:pb-20'}`}>
          <div className="text-[13px] font-medium uppercase tracking-[0.16em]">{eyebrow}</div>
          <h1 className="mt-[18px] max-w-[12ch] text-[clamp(60px,12vw,176px)] font-light leading-[0.88] tracking-[-0.05em]">
            ¿Dónde voy <span className="font-medium">hoy?</span>
          </h1>
          <div className="mt-9 flex flex-wrap items-end justify-between gap-7">
            <p className="max-w-[440px] text-[clamp(17px,1.5vw,20px)] leading-normal">
              Con quién estás, cuánto quieres gastar, qué ambiente buscas. Tres toques y te decimos dónde ir.
            </p>
            <PromptBar />
          </div>
          {hasCards && <HeroCarousel places={places} />}
        </div>
      </section>
      {hasCards && <div className="h-24" aria-hidden />}
    </>
  )
}

/** Fila discreta bajo el hero con las ciudades cubiertas; lleva al listado por ciudad. */
export function CityStrip({ label }: { label: string }) {
  return (
    <div className={`${landingContainer} pt-10`}>
      <Link href="/places" className="inline-flex items-start gap-2 text-sm text-muted transition hover:text-ink">
        <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink" aria-hidden />
        <span>Ya en {label}</span>
      </Link>
    </div>
  )
}
