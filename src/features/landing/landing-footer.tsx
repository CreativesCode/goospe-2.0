import Link from 'next/link'
import { eyebrow } from '@/shared/lib/ui'
import { landingContainer } from './landing-shared'

const COLUMNS = [
  {
    title: 'Descubre',
    links: [
      { href: '/search', label: 'Buscar' },
      { href: '/events', label: 'Eventos' },
      { href: '/places', label: 'Ciudades' },
      { href: '/concierge', label: 'Decídeme' },
    ],
  },
  {
    title: 'Negocios',
    links: [
      { href: '/panel', label: '¿Tienes un negocio?' },
      { href: '/panel/claim', label: 'Reclamar ficha' },
      { href: '/panel/propose', label: 'Proponer un lugar' },
    ],
  },
  {
    title: 'Goospe',
    links: [
      { href: '/about', label: 'Quiénes somos' },
      { href: '/help', label: 'Ayuda' },
      { href: '/contact', label: 'Contacto' },
      { href: '/feedback', label: 'Enviar comentarios' },
    ],
  },
]

const linkClass = 'transition hover:text-ink'

/** Footer completo de 4 columnas (solo en el landing; la app usa el compacto). */
export function LandingFooter({ year }: { year: number }) {
  return (
    <footer className="border-t border-line">
      <div className={`${landingContainer} grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-8 pb-7 pt-12 text-sm`}>
        <div>
          <img src="/brand/logo-color-suggest.svg" alt="Goospe sugiere" className="h-[34px] dark:hidden" />
          <img src="/brand/logo-white-suggest.svg" alt="Goospe sugiere" className="hidden h-[34px] dark:block" />
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col items-start gap-2.5">
            <div className={eyebrow}>{col.title}</div>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className={`${landingContainer} flex flex-wrap justify-between gap-x-6 gap-y-3 pb-8 pt-5 text-[13px] text-muted`}>
          <span>© {year} Goospe · Chile</span>
          <div className="flex gap-5">
            <Link href="/terms" className={linkClass}>Términos</Link>
            <Link href="/privacy" className={linkClass}>Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
