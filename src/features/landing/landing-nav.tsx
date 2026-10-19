import Link from 'next/link'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { brandBtn, landingContainer } from './landing-shared'

const LINKS = [
  { href: '/places', label: 'Lugares' },
  { href: '/events', label: 'Eventos' },
  { href: '/concierge', label: 'Decídeme' },
  { href: '#negocios', label: 'Para negocios' },
]

/** Barra superior sticky del landing: logo, enlaces (desde tablet), tema y accesos a la app. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/[0.86] pt-[var(--sat)] backdrop-blur-[14px]">
      <div className={`${landingContainer} flex items-center gap-3 py-3.5 md:gap-7`}>
        <Link href="/" className="flex shrink-0" aria-label="Goospe">
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-[26px] dark:hidden" />
          <img src="/brand/logo-white.svg" alt="Goospe" className="hidden h-[26px] dark:block" />
        </Link>
        <nav className="hidden gap-1 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 transition hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <ThemeToggle />
          {/* En pantallas muy estrechas no cabe todo: "Abrir Goospe" ya lleva a la app. */}
          <Link href="/login" className="flex h-10 items-center px-3 text-sm font-medium text-fg transition hover:text-ink max-[379px]:hidden md:px-4">
            Entrar
          </Link>
          <Link href="/feed" className={`${brandBtn} h-10 whitespace-nowrap px-4 text-sm md:px-[18px]`}>
            Abrir Goospe
          </Link>
        </div>
      </div>
    </header>
  )
}
