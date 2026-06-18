'use client'

import type { LucideIcon } from 'lucide-react'

/** Chip seleccionable (onboarding, filtros). Soporta icono Lucide opcional. */
export function Chip({
  label,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string
  icon?: LucideIcon
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-goospe-green text-white'
          : 'border border-line bg-card text-fg-soft hover:border-goospe-green/40 hover:text-fg'
      }`}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      {label}
    </button>
  )
}
