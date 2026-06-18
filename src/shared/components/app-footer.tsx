import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/buscar', label: 'Buscar' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/concierge', label: 'Decídeme' },
  { href: '/panel', label: '¿Tienes un negocio?' },
]

/**
 * Footer global. Incluye `pb` extra en móvil para no quedar bajo la tab bar de <AppNav />.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface px-5 pb-24 pt-8 text-sm text-muted md:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <span>Goospe · Puerto Varas, Chile</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-fg">{l.label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
