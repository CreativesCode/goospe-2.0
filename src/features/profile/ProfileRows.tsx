'use client'

import { useState } from 'react'
import { ChevronRight, LogOut, SunMoon } from 'lucide-react'
import { signout } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/shared/components/theme-provider'
import { PROFILE_ROW as ROW } from './profile-row'

/** Fila "Apariencia": alterna claro/oscuro y muestra el tema activo como pista. */
export function AppearanceRow() {
  const { theme, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle} className={ROW} aria-label={`Apariencia: ${theme === 'dark' ? 'oscuro' : 'claro'}. Cambiar`}>
      <SunMoon size={18} strokeWidth={1.75} className="shrink-0 text-fg-soft" />
      <span className="flex-1">Apariencia</span>
      {/* El tema real se conoce tras hidratar (lo fija el script de <head>). */}
      <span className="text-[13px] text-muted" suppressHydrationWarning>{theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
      <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
    </button>
  )
}

/**
 * Fila "Cerrar sesión". Igual que el menú de cuenta: primero en el cliente del navegador (la
 * UI reacciona al instante) y luego en el servidor (limpia cookies y redirige).
 */
export function SignOutRow() {
  const [leaving, setLeaving] = useState(false)
  async function onSignOut() {
    setLeaving(true)
    try { await createClient().auth.signOut() } catch { /* el servidor cierra igual */ }
    await signout()
  }
  return (
    <button type="button" onClick={onSignOut} disabled={leaving} className={`${ROW} !text-red-600 hover:!bg-red-500/10 disabled:opacity-60 dark:!text-red-400`}>
      <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
      <span className="flex-1">{leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
    </button>
  )
}
