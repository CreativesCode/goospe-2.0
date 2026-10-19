import Link from 'next/link'
import { Coffee, Martini, Sparkles, type LucideIcon } from 'lucide-react'
import { brandBtn, landingContainer, sectionEyebrow, sectionTitle } from './landing-shared'

const STEPS = [
  { n: '01', title: 'Dinos el plan', text: 'Con quién sales, qué presupuesto y qué ambiente buscas. Tres toques.' },
  { n: '02', title: 'Goospe elige', text: 'El conserje IA combina tu gusto, la hora y la cercanía para decidir contigo.' },
  { n: '03', title: 'Anda', text: 'Guarda, pide cómo llegar o confirma tu asistencia. Listo.' },
]

/** "Cómo funciona": tres pasos con numeral grande decorativo (por eso va en verde de marca). */
export function HowItWorks() {
  return (
    <section className={`${landingContainer} py-[72px]`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={`${sectionEyebrow} text-ink`}>Cómo funciona</div>
          <h2 className={`${sectionTitle} mt-3 text-fg`}>
            Decidir es de <span className="font-medium">un toque</span>
          </h2>
        </div>
        <p className="max-w-[360px] text-[15px] leading-[1.55]">
          Sin scroll infinito ni listas de 40 resultados. Goospe combina tu gusto, la hora y la cercanía.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] border-t border-line">
        {STEPS.map((s) => (
          <div key={s.n} className="pb-2 pr-7 pt-7">
            <div className="text-[56px] font-light leading-none tracking-[-0.04em] text-goospe-green" aria-hidden>{s.n}</div>
            <h3 className="mt-5 text-xl font-medium text-fg">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-[1.55]">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// Ejemplo ILUSTRATIVO de una respuesta del conserje: nombres ficticios, sin foto ni distancia.
// No se atribuyen razones inventadas a negocios reales.
const CONCIERGE_PROMPT = 'algo chill y barato para 3 cerca del centro'
const CONCIERGE_PICKS: { n: number; name: string; meta: string; why: string; icon: LucideIcon }[] = [
  { n: 1, name: 'Bar La Cervecería', meta: 'Bar · $$', why: 'Tranquilo y con mesas para grupo, sin disparar la cuenta.', icon: Martini },
  { n: 2, name: 'Patio Cervecero', meta: 'Bar · $', why: 'Al aire libre y relajado, perfecto para conversar.', icon: Martini },
  { n: 3, name: 'Café del Lago', meta: 'Café · $$', why: 'Si prefieren sin alcohol: terraza y rica repostería.', icon: Coffee },
]

function ConciergePick({ pick }: { pick: (typeof CONCIERGE_PICKS)[number] }) {
  const Icon = pick.icon
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] border border-line bg-card p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-tint text-goospe-green">
        <Icon size={24} strokeWidth={1.75} aria-hidden />
        <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-[#1C1C1A] text-xs font-medium text-white">
          {pick.n}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2">
          <span className="font-medium text-fg">{pick.name}</span>
          <span className="shrink-0 text-[13px] text-muted">{pick.meta}</span>
        </div>
        <p className="mt-[3px] text-sm leading-[1.4] text-fg-soft">“{pick.why}”</p>
      </div>
    </div>
  )
}

/** Sección del conserje: oscura fija en ambos temas, con una conversación de ejemplo. */
export function ConciergeSection() {
  return (
    <section className="border-y border-line bg-[#131210]">
      <div className={`${landingContainer} grid grid-cols-1 items-center gap-14 py-[88px] min-[900px]:grid-cols-2`}>
        <div className="min-w-0">
          <div className={`${sectionEyebrow} text-goospe-green-light`}>El conserje</div>
          <h2 className={`${sectionTitle} mt-3 leading-[1.08] text-[#F3EFE8]`}>
            Decide por mí, <span className="font-medium">en serio</span>
          </h2>
          <p className="mt-[18px] max-w-[460px] text-[17px] leading-[1.6] text-[#C7C1B7]">
            Escribe en tus palabras y te damos tres opciones con el porqué de cada una. Compártelas con tu grupo y
            decidan juntos.
          </p>
          <Link href="/concierge" className={`${brandBtn} mt-7 h-12 px-[22px] text-[15px]`}>
            <Sparkles size={17} strokeWidth={1.75} aria-hidden /> Probar Decídeme
          </Link>
        </div>
        <div className="flex min-w-0 flex-col gap-3" role="img" aria-label={`Ejemplo: pides «${CONCIERGE_PROMPT}» y Goospe responde con tres opciones y el porqué de cada una.`}>
          <div className="max-w-[85%] self-end rounded-[20px_20px_6px_20px] bg-goospe-green px-4 py-3 text-[15px] leading-[1.45] text-on-brand">
            {CONCIERGE_PROMPT}
          </div>
          {CONCIERGE_PICKS.map((p) => (
            <ConciergePick key={p.n} pick={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
