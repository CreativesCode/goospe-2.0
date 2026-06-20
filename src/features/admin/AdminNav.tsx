'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Store, Users, BadgeCheck, Sparkles, BarChart3, Image, MessageSquare, Globe,
  type LucideIcon,
} from 'lucide-react'

type Item = { href: string; label: string; icon: LucideIcon }

const ITEMS: Item[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/places', label: 'Lugares', icon: Store },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/claims', label: 'Reclamos', icon: BadgeCheck },
  { href: '/admin/ai-costs', label: 'Gastos IA', icon: Sparkles },
  { href: '/admin/stats', label: 'Estadísticas', icon: BarChart3 },
  { href: '/admin/photos', label: 'Moderar fotos', icon: Image },
  { href: '/admin/content', label: 'Moderar contenido', icon: MessageSquare },
]

// El cargador de zonas es local-only. El menú solo aparece en localhost (el gate real es
// server-side en la ruta/acción). Se detecta tras montar para no romper la hidratación.
const LOADER_ITEM: Item = { href: '/admin/loader', label: 'Cargador de zonas', icon: Globe }

const active = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

/** Navegación del backoffice: sidebar en `lg:`, tabs con scroll horizontal en móvil. */
export function AdminNav() {
  const pathname = usePathname()
  const [isLocal, setIsLocal] = useState(false)
  useEffect(() => {
    setIsLocal(/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname))
  }, [])

  const items = isLocal ? [...ITEMS, LOADER_ITEM] : ITEMS

  return (
    <nav className="mb-4 lg:mb-0 lg:w-56 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {items.map(({ href, label, icon: Icon }) => {
          const on = active(pathname, href)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition lg:w-full ${
                  on ? 'bg-goospe-green/10 text-goospe-green-dark' : 'text-fg-soft hover:bg-card hover:text-fg'
                }`}
              >
                <Icon size={17} strokeWidth={1.75} /> {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
