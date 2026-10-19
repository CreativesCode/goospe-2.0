'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/components/theme-provider'

/** Botón pill para alternar claro/oscuro. Vive en Perfil y en el menú de cuenta. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg-soft transition hover:text-fg md:h-[38px] md:w-[38px] ${className}`}
    >
      {isDark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
    </button>
  )
}
