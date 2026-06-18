'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemeCtx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }

const Ctx = createContext<ThemeCtx | null>(null)
const STORAGE_KEY = 'goospe-theme'

/** Lee el tema inicial sin causar flash: lo dejó el script de <head> en la clase de <html>. */
function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    setThemeState(readTheme())
  }, [])

  const apply = (t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* almacenamiento no disponible */
    }
    setThemeState(t)
  }

  const value: ThemeCtx = {
    theme,
    setTheme: apply,
    toggle: () => apply(theme === 'dark' ? 'light' : 'dark'),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}

/**
 * Script que corre antes de la hidratación para fijar la clase `dark` en <html>
 * según localStorage o `prefers-color-scheme`. Evita el flash de tema incorrecto.
 */
export const themeInitScript = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`
