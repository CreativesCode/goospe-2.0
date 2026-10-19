import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { LandingNav } from '@/features/landing/landing-nav'
import { CityStrip, LandingHero } from '@/features/landing/landing-hero'
import { ConciergeSection, HowItWorks } from '@/features/landing/landing-sections'
import { TwoSides } from '@/features/landing/landing-two-sides'
import { LandingFooter } from '@/features/landing/landing-footer'
import type { HeroPlace } from '@/features/landing/landing-shared'

// ISR: la landing muestra conteo de lugares, ciudades activas y un carrusel de lugares reales;
// se regenera cada hora.
export const revalidate = 3600

// "A", "A y B", "A, B y C" — para listar las ciudades cubiertas en prosa.
function formatCityList(names: string[]): string {
  if (names.length === 0) return 'tu ciudad'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export const metadata: Metadata = {
  title: 'Goospe — ¿dónde voy hoy? Lugares y eventos cerca de ti',
  description:
    'Descubre dónde ir cerca de ti: cafés, restaurantes, bares y eventos, con un conserje IA que decide por ti en 30 segundos.',
  alternates: { canonical: '/' },
}

// Misma semilla anónima que el feed SSR (app/feed/page.tsx): centro por defecto del piloto.
const SEED = { lat: -41.3195, lng: -72.9854 }
const HERO_CARDS = 8
// Ciudades que se nombran en la fila bajo el hero; el resto se resume como "y N más".
const CITIES_SHOWN = 6

const nf = new Intl.NumberFormat('es-CL')
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`

// "Goospe sugiere · 28 ciudades · 3.700 lugares": el eyebrow no puede listar todas las ciudades.
function heroEyebrow(cityCount: number, placeCount: number | null): string {
  const parts = ['Goospe sugiere']
  if (cityCount > 0) parts.push(plural(cityCount, 'ciudad', 'ciudades'))
  if (placeCount) parts.push(plural(placeCount, 'lugar', 'lugares'))
  return parts.join(' · ')
}

// "A, B, C y 22 ciudades más" (o la lista completa si son pocas).
function cityStripLabel(cities: string[]): string {
  if (cities.length <= CITIES_SHOWN + 1) return formatCityList(cities)
  const rest = cities.length - CITIES_SHOWN
  return formatCityList([...cities.slice(0, CITIES_SHOWN), `${rest} ciudades más`])
}

export default async function Landing() {
  const sb = createAdminClient()
  const [{ count }, { data: cityRows }, feed] = await Promise.all([
    sb.from('places').select('*', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('cities').select('name').eq('is_active', true).order('name'),
    sb.rpc('get_feed', { p_lat: SEED.lat, p_lng: SEED.lng, p_radius_m: 25000, p_limit: HERO_CARDS, p_offset: 0 }),
  ])
  const cities = (cityRows ?? []).map((c) => c.name as string)
  // Si la RPC falla o viene vacía, el hero se pinta sin carrusel.
  const places = ((feed.data ?? []) as HeroPlace[]).filter((p) => p.slug && p.name)

  return (
    <div className="min-h-[100dvh] bg-surface">
      <LandingNav />
      {/* overflow-x-hidden: red de seguridad para el isotipo y el carrusel que sangran a la derecha. */}
      <main className="overflow-x-hidden">
        <LandingHero eyebrow={heroEyebrow(cities.length, count ?? null)} places={places} />
        {cities.length > 0 && <CityStrip label={cityStripLabel(cities)} />}
        <HowItWorks />
        <ConciergeSection />
        <TwoSides />
      </main>
      <LandingFooter year={new Date().getFullYear()} />
    </div>
  )
}
