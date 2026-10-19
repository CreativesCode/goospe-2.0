import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export const PROFILE_ROW = 'flex min-h-[54px] w-full items-center gap-3.5 border-line px-4 text-left text-[15px] text-fg transition hover:bg-tint [&:not(:first-child)]:border-t'

/**
 * Fila enlazada de las listas del perfil: icono, etiqueta, pista opcional y chevron.
 * Va en un módulo de servidor: recibe el icono como componente, que no puede cruzar a un
 * client component (las filas con estado están en ProfileRows.tsx).
 */
export function ProfileRow({ href, icon: Icon, label, hint }: { href: string; icon: LucideIcon; label: string; hint?: string }) {
  return (
    <Link href={href} className={PROFILE_ROW}>
      <Icon size={18} strokeWidth={1.75} className="shrink-0 text-fg-soft" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
      <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
    </Link>
  )
}
