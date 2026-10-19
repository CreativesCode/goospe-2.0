import Link from 'next/link'
import { ArrowRight, BadgeCheck, Calendar, Megaphone, Smartphone, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react'
import { brandBtn, landingContainer, sectionEyebrow } from './landing-shared'

type Row = { icon: LucideIcon; title: string; text: string }

const FOR_PEOPLE: Row[] = [
  { icon: Smartphone, title: 'Feed de lugares', text: 'Foto, vibe, precio y distancia. Desliza y decide.' },
  { icon: Sparkles, title: 'Conserje IA', text: 'Tres opciones con su porqué, en segundos.' },
  { icon: Calendar, title: 'Eventos de hoy', text: 'Qué pasa esta semana, con asistencia de un toque.' },
]

const FOR_BUSINESS: Row[] = [
  { icon: BadgeCheck, title: 'Reclama tu ficha', text: 'Horario, fotos, contacto y carta, siempre al día.' },
  { icon: TrendingUp, title: 'Estadísticas e informe semanal', text: 'Vistas, guardados y “cómo llego”, resumidos por IA.' },
  { icon: Megaphone, title: 'Eventos y destacados', text: 'Publica eventos y sube al feed cuando lo necesites.' },
]

const cardBase = 'flex min-w-0 flex-col rounded-[28px] p-[clamp(28px,3.5vw,44px)]'
const cardTitle = 'mt-3 text-[clamp(28px,2.8vw,38px)] font-light tracking-[-0.02em]'

/** Fila icono + título + texto. `dark`: variante sobre la tarjeta `deep` (colores fijos). */
function FeatureRow({ row, dark = false }: { row: Row; dark?: boolean }) {
  const Icon = row.icon
  return (
    <div className={`flex gap-4 border-t py-4 ${dark ? 'border-white/10' : 'border-line'}`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          dark ? 'bg-goospe-green/[0.16] text-goospe-green-light' : 'bg-tint text-ink'
        }`}
      >
        <Icon size={19} strokeWidth={1.75} aria-hidden />
      </span>
      <div>
        <div className={`font-medium ${dark ? 'text-[#F3EFE8]' : 'text-fg'}`}>{row.title}</div>
        <div className="mt-0.5 text-sm">{row.text}</div>
      </div>
    </div>
  )
}

function ForPeople() {
  return (
    <div className={`${cardBase} border border-line bg-card`}>
      <div className={`${sectionEyebrow} text-ink`}>Para salir</div>
      <h2 className={`${cardTitle} text-fg`}>
        Todo lo de hoy, <span className="font-medium">cerca de ti</span>
      </h2>
      <div className="mt-7 flex flex-col">
        {FOR_PEOPLE.map((r) => <FeatureRow key={r.title} row={r} />)}
      </div>
      <div className="mt-auto pt-6">
        <Link href="/feed" className="inline-flex items-center gap-2 font-medium text-ink transition hover:opacity-80">
          Abrir Goospe <ArrowRight size={16} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  )
}

function ForBusiness() {
  return (
    <div className={`${cardBase} relative overflow-hidden bg-deep text-deep-soft`}>
      <img src="/brand/isotipo-white.svg" alt="" aria-hidden className="pointer-events-none absolute -right-10 -top-10 w-[200px] opacity-[0.06]" />
      <div className={`${sectionEyebrow} text-goospe-green-light`}>Para tu negocio</div>
      <h2 className={`${cardTitle} text-[#F3EFE8]`}>
        Que te elijan <span className="font-medium">hoy</span>
      </h2>
      <div className="mt-7 flex flex-col">
        {FOR_BUSINESS.map((r) => <FeatureRow key={r.title} row={r} dark />)}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
        <Link href="/panel/claim" className={`${brandBtn} h-[46px] px-5 text-[15px]`}>
          Reclamar mi negocio <ArrowRight size={16} strokeWidth={2} aria-hidden />
        </Link>
        <span className="text-[13px]">Gratis durante el piloto</span>
      </div>
    </div>
  )
}

/** B2C y B2B al mismo nivel: dos tarjetas en columnas desde 900 px. Ancla de "Para negocios". */
export function TwoSides() {
  return (
    <section id="negocios" className={`${landingContainer} grid scroll-mt-20 grid-cols-1 gap-5 py-[88px] min-[900px]:grid-cols-2`}>
      <ForPeople />
      <ForBusiness />
    </section>
  )
}
