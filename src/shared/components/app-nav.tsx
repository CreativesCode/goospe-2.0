'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Smartphone, Search, Calendar, Heart, Sparkles, User, LogIn, type LucideIcon } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Notifications } from '@/features/notifications/Notifications'
import { AccountMenu } from '@/features/auth/components'
import { useAuth } from '@/hooks/useAuth'

type NavLink = { href: string; label: string; icon: LucideIcon; also?: string[] }

// Enlaces del top bar (tablet/web).
const TOP_LINKS: NavLink[] = [
  { href: '/feed', label: 'Feed', icon: Smartphone },
  { href: '/search', label: 'Buscar', icon: Search },
  { href: '/events', label: 'Eventos', icon: Calendar },
  { href: '/saved', label: 'Guardados', icon: Heart },
  { href: '/concierge', label: 'Decídeme', icon: Sparkles },
]

// Pestañas de la barra inferior (móvil): Decídeme al centro. La última depende de la sesión.
const BASE_TABS: NavLink[] = [
  { href: '/feed', label: 'Feed', icon: Smartphone },
  { href: '/search', label: 'Buscar', icon: Search },
  { href: '/concierge', label: 'Decídeme', icon: Sparkles },
  { href: '/events', label: 'Eventos', icon: Calendar },
]
// Guardados, notificaciones y el panel de negocio cuelgan de Perfil en móvil.
const PROFILE_TAB: NavLink = { href: '/profile', label: 'Perfil', icon: User, also: ['/saved', '/panel', '/notifications'] }
const LOGIN_TAB: NavLink = { href: '/login', label: 'Entrar', icon: LogIn }

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)
const isActive = (pathname: string, link: NavLink) =>
  matches(pathname, link.href) || (link.also ?? []).some((h) => matches(pathname, h))

/** Clases de un botón redondo del top bar que en móvil va sin borde ni fondo. */
const BARE_ON_MOBILE = 'max-md:border-transparent max-md:bg-transparent'

/**
 * Barra inferior fija de la app en móvil (64 px + safe-area). `tone="dark"` es la del feed,
 * que va sobre el mazo oscuro. Quien la monte debe reservar su alto: <AppFooter /> ya lo hace.
 */
export function TabBar({ tone = 'surface' }: { tone?: 'surface' | 'dark' }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  // Mientras carga la sesión mantenemos "Perfil" para no parpadear de Entrar→Perfil.
  const tabs: NavLink[] = [...BASE_TABS, loading || user ? PROFILE_TAB : LOGIN_TAB]
  const dark = tone === 'dark'

  return (
    <nav
      aria-label="Navegación principal"
      className={`fixed inset-x-0 bottom-0 z-40 border-t pb-[var(--sab)] backdrop-blur-[14px] md:hidden ${
        dark ? 'border-white/[0.08] bg-[rgba(18,19,17,0.94)]' : 'border-line bg-surface/[0.94]'
      }`}
    >
      <div className="grid h-16 grid-cols-5 items-center">
        {tabs.map((tab) => {
          const { href, label, icon: Icon } = tab
          const active = isActive(pathname, tab)
          const center = href === '/concierge'
          const color = active
            ? dark ? 'text-goospe-green-light' : 'text-ink'
            : dark ? 'text-white/[0.62]' : 'text-muted'
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-full flex-col items-center justify-center gap-[3px] text-[11px] font-medium transition ${color}`}
            >
              <span className={`flex items-center justify-center rounded-full ${center ? 'h-[30px] w-11 bg-goospe-gradient text-on-brand' : 'h-7 w-7'}`}>
                <Icon size={21} strokeWidth={active || center ? 2 : 1.75} />
              </span>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * Navegación global responsive:
 * - Tablet/Web: top bar sticky con logo, nav en píldoras (solo iconos entre 720 y 899 px),
 *   tema, notificaciones y cuenta.
 * - Móvil: top bar simple (logo + tema + campana) y tab bar inferior fija.
 * Las páginas que usan <AppNav /> cierran con <AppFooter />, que reserva el alto de la tab bar.
 */
export function AppNav() {
  const pathname = usePathname()

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/[0.88] pt-[var(--sat)] backdrop-blur-[14px]">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-2.5 md:gap-5 md:px-6 md:py-3 lg:px-8">
          <Link href="/feed" className="shrink-0">
            <img src="/brand/logo-color.svg" alt="Goospe" className="h-[22px] dark:hidden md:h-[26px]" />
            <img src="/brand/logo-white.svg" alt="Goospe" className="hidden h-[22px] dark:block md:h-[26px]" />
          </Link>

          <nav aria-label="Secciones" className="hidden items-center gap-0.5 md:flex">
            {TOP_LINKS.map((link) => {
              const { href, label, icon: Icon } = link
              const active = isActive(pathname, link)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                  className={`inline-flex h-[38px] items-center gap-[7px] rounded-full px-[11px] text-sm font-medium transition min-[900px]:px-3.5 ${
                    active ? 'bg-tint2 text-ink' : 'text-fg-soft hover:text-fg'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span className="hidden min-[900px]:inline">{label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <ThemeToggle className={BARE_ON_MOBILE} />
            <Notifications className={BARE_ON_MOBILE} />
            {/* En móvil la cuenta vive en la pestaña Perfil / Entrar de la tab bar. */}
            <div className="hidden md:block"><AccountMenu /></div>
          </div>
        </div>
      </header>

      <TabBar />
    </>
  )
}
