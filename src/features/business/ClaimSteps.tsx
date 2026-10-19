import Link from 'next/link'
import { ArrowRight, BadgeCheck, MapPinPlus, PhoneCall, Search, Store, type LucideIcon } from 'lucide-react'

type Step = { icon: LucideIcon; title: string; text: string }
type Variant = 'claim' | 'propose'

const CONTENT: Record<Variant, { title: [string, string]; steps: Step[]; link: { href: string; label: string } }> = {
  claim: {
    title: ['Tu ficha, ', 'al día'],
    steps: [
      { icon: Search, title: 'Busca tu lugar', text: 'Escribe el nombre tal como aparece en Goospe.' },
      { icon: BadgeCheck, title: 'Solicita administrarlo', text: 'Déjanos tu nombre y un teléfono de contacto.' },
      { icon: PhoneCall, title: 'Te contactamos', text: 'Confirmamos que es tuyo y te damos acceso al panel.' },
    ],
    link: { href: '/panel/propose', label: '¿No está tu lugar? Proponlo' },
  },
  propose: {
    title: ['Súmate a ', 'Goospe'],
    steps: [
      { icon: MapPinPlus, title: 'Cuéntanos dónde queda', text: 'Nombre, categoría, dirección y, si puedes, el pin del mapa.' },
      { icon: PhoneCall, title: 'Lo revisamos a mano', text: 'Confirmamos que existe y completamos la ficha.' },
      { icon: Store, title: 'Lo administras tú', text: 'Al publicarlo quedas como su administrador.' },
    ],
    link: { href: '/panel/claim', label: '¿Ya está en Goospe? Reclámalo' },
  },
}

/** Tarjeta `deep` con los pasos para reclamar o proponer un lugar (columna lateral en web). */
export function ClaimSteps({ variant = 'claim' }: { variant?: Variant }) {
  const c = CONTENT[variant]
  return (
    <aside className="relative overflow-hidden rounded-[28px] bg-deep p-6 text-deep-soft lg:sticky lg:top-24 lg:p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/isotipo-white.svg" alt="" aria-hidden className="pointer-events-none absolute -right-10 -top-10 w-[180px] opacity-[0.06]" />
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-goospe-green-light">Cómo funciona</div>
      <p className="mt-2 text-[26px] font-light leading-tight tracking-[-0.02em] text-[#F3EFE8]">
        {c.title[0]}<span className="font-medium">{c.title[1]}</span>
      </p>
      <ol className="mt-5 flex flex-col">
        {c.steps.map((s, i) => {
          const Icon = s.icon
          return (
            <li key={s.title} className="flex gap-4 border-t border-white/10 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-goospe-green/[0.16] text-goospe-green-light">
                <Icon size={19} strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <div className="font-medium text-[#F3EFE8]">{i + 1}. {s.title}</div>
                <div className="mt-0.5 text-sm">{s.text}</div>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="border-t border-white/10 pt-4 text-[13px]">
        Gratis durante el piloto.{' '}
        <Link href={c.link.href} className="inline-flex items-center gap-1 font-medium text-goospe-green-light hover:underline">
          {c.link.label} <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </aside>
  )
}
