import Link from 'next/link'
import { safeNext } from '@/lib/safe-next'

const TABS = [
  { key: 'login', href: '/login', label: 'Entrar' },
  { key: 'signup', href: '/signup', label: 'Crear cuenta' },
] as const

/**
 * Selector segmentado Entrar / Crear cuenta. Son dos rutas reales, así que cada opción es un
 * enlace; `next` (el `?next=` crudo de la URL) se sanea y se conserva al cambiar de pestaña.
 */
export function AuthTabs({ active, next }: { active: 'login' | 'signup'; next?: string }) {
  const safe = safeNext(next, '')
  const query = safe ? `?next=${encodeURIComponent(safe)}` : ''

  return (
    <nav aria-label="Acceso" className="grid grid-cols-2 rounded-full border border-line bg-card p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`${t.href}${query}`}
          aria-current={active === t.key ? 'page' : undefined}
          className={`flex h-10 items-center justify-center rounded-full text-sm font-medium transition ${
            active === t.key ? 'bg-goospe-green text-on-brand' : 'text-fg-soft hover:text-fg'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

/** Título (30 px, peso 300) + subtítulo de las pantallas de auth. */
export function AuthHeading({ title, subtitle, className = '' }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`mb-6 ${className}`}>
      <h1 className="text-[30px] font-light leading-tight tracking-[-0.02em] text-fg">{title}</h1>
      {subtitle && <p className="mt-1.5 text-fg-soft">{subtitle}</p>}
    </div>
  )
}

/** Pie de Entrar / Crear cuenta: la app se puede usar sin sesión. */
export function ExploreWithoutAccount() {
  return (
    <p className="mt-6 text-center text-[13px] text-muted">
      Puedes usar Goospe sin cuenta.{' '}
      <Link href="/feed" className="font-medium text-ink hover:underline">Explorar sin entrar</Link>
    </p>
  )
}

/** Enlace de regreso a /login para las pantallas sin segmentado. */
export function BackToLogin() {
  return (
    <p className="mt-6 text-center text-[13px] text-muted">
      <Link href="/login" className="font-medium text-ink hover:underline">Volver a entrar</Link>
    </p>
  )
}
