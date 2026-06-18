'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Smartphone, Search, Calendar, Heart, Sparkles, User, type LucideIcon } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Notifications } from '@/features/notifications/Notifications'
import { AccountMenu } from '@/features/auth/components'

type NavLink = { href: string; label: string; icon: LucideIcon }

// Enlaces del navbar superior (tablet/web).
const TOP_LINKS: NavLink[] = [
  { href: '/feed', label: 'Feed', icon: Smartphone },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/eventos', label: 'Eventos', icon: Calendar },
  { href: '/saved', label: 'Guardados', icon: Heart },
  { href: '/concierge', label: 'Decídeme', icon: Sparkles },
]

// Pestañas de la barra inferior (móvil).
const TABS: NavLink[] = [
  { href: '/feed', label: 'Feed', icon: Smartphone },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/concierge', label: 'Decídeme', icon: Sparkles },
  { href: '/eventos', label: 'Eventos', icon: Calendar },
  { href: '/perfil', label: 'Perfil', icon: User },
]

const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/feed' && pathname.startsWith(href))

/**
 * Navegación global responsive:
 * - Móvil: barra superior compacta (logo + tema + cuenta) + tab bar inferior fija.
 * - Tablet/Web: barra superior con enlaces inline; sin tab bar.
 * Las páginas que usan <AppNav /> deben dejar `pb-20 sm:pb-0` en su contenedor
 * para que la tab bar móvil no tape el contenido (o usar <AppFooter />, que ya lo hace).
 */
export function AppNav() {
  const pathname = usePathname()

  return (
    <>
      {/* ===== barra superior ===== */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/feed" className="shrink-0">
            <img src="/brand/logo-color.svg" alt="Goospe" className="h-7 dark:hidden" />
            <img src="/brand/logo-white.svg" alt="Goospe" className="hidden h-7 dark:block" />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {TOP_LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-goospe-green/10 text-goospe-green-dark' : 'text-fg-soft hover:text-fg'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} /> {label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Notifications />
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* ===== tab bar inferior (solo móvil) ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-medium transition ${
                  active ? 'text-goospe-green-dark' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.75} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
