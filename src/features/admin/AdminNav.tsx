'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Store, Users, BadgeCheck, Sparkles, BarChart3, Image, MessageSquare, Globe, MapPin, PencilLine, ScrollText, MessageCircleWarning,
  TrendingUp, SlidersHorizontal, ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { pill } from '@/shared/lib/ui'

type Item = { href: string; label: string; icon: LucideIcon }
type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  { title: 'Operación', items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/places', label: 'Lugares', icon: Store },
    { href: '/admin/users', label: 'Usuarios', icon: Users },
  ] },
  { title: 'Bandejas', items: [
    { href: '/admin/claims', label: 'Reclamos', icon: BadgeCheck },
    { href: '/admin/requests', label: 'Solicitudes', icon: PencilLine },
    { href: '/admin/feedback', label: 'Feedback', icon: MessageCircleWarning },
  ] },
  { title: 'Moderación', items: [
    { href: '/admin/photos', label: 'Fotos', icon: Image },
    { href: '/admin/content', label: 'Contenido', icon: MessageSquare },
  ] },
  { title: 'Métricas', items: [
    { href: '/admin/stats', label: 'Estadísticas', icon: BarChart3 },
    { href: '/admin/product', label: 'Producto', icon: TrendingUp },
    { href: '/admin/ai-costs', label: 'Gastos IA', icon: Sparkles },
  ] },
  { title: 'Ajustes', items: [
    { href: '/admin/ranking', label: 'Ranking del feed', icon: SlidersHorizontal },
    { href: '/admin/zones', label: 'Zonas sin cobertura', icon: MapPin },
    { href: '/admin/audit', label: 'Bitácora', icon: ScrollText },
  ] },
]

// El cargador de zonas es local-only. El menú solo aparece en localhost (el gate real es
// server-side en la ruta/acción). Se detecta tras montar para no romper la hidratación.
const LOADER_ITEM: Item = { href: '/admin/loader', label: 'Cargador de zonas', icon: Globe }

const active = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-goospe-green px-[7px] py-0.5 text-[11px] leading-none text-on-brand" aria-label={`${count} pendientes`}>
      {count}
    </span>
  )
}

/**
 * Navegación del backoffice. Web (`lg:`): lateral fijo agrupado por secciones, mismo
 * lenguaje que el panel del dueño. Tablet/móvil: chips con scroll horizontal.
 * `badges` = pendientes por ruta (reclamos, solicitudes y lugares propuestos, feedback).
 */
export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname()
  const [isLocal, setIsLocal] = useState(false)
  useEffect(() => {
    setIsLocal(/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname))
  }, [])

  const groups = isLocal
    ? GROUPS.map((g) => (g.title === 'Ajustes' ? { ...g, items: [...g.items, LOADER_ITEM] } : g))
    : GROUPS

  return (
    <>
      <aside className="sticky top-[88px] hidden flex-col gap-[18px] lg:flex">
        <div className="flex items-center gap-2.5 rounded-[18px] bg-deep p-3 text-deep-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-goospe-green/[0.16] text-goospe-green-light">
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[#F3EFE8]">Backoffice</span>
            <span className="block text-xs">Equipo Goospe</span>
          </span>
        </div>
        <nav aria-label="Secciones del backoffice" className="flex flex-col gap-3.5">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{g.title}</div>
              {g.items.map(({ href, label, icon: Icon }) => {
                const on = active(pathname, href)
                return (
                  <Link key={href} href={href} aria-current={on ? 'page' : undefined}
                    className={`flex h-[40px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition ${on ? 'bg-tint2 text-ink' : 'text-fg-soft hover:bg-tint hover:text-fg'}`}>
                    <Icon size={17} strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{label}</span>
                    <Badge count={badges[href] ?? 0} />
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <nav aria-label="Secciones del backoffice" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6 lg:hidden">
        {groups.flatMap((g) => g.items).map(({ href, label, icon: Icon }) => {
          const on = active(pathname, href)
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={pill(on)}>
              <Icon size={15} strokeWidth={1.75} aria-hidden /> {label}
              {(badges[href] ?? 0) > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-on-brand/15' : 'bg-goospe-green text-on-brand'}`}>{badges[href]}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
