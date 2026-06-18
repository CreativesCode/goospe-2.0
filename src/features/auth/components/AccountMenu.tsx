'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, Heart, Store, Calendar, Sparkles, ShieldCheck, Sun, Moon, LogOut, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { signout } from '@/actions/auth'
import { useTheme } from '@/shared/components/theme-provider'

// Indicador de sesión para el feed: avatar con inicial + menú (Guardados / tema / Cerrar sesión).
// Sin sesión muestra un botón "Entrar". Pensado sobre fondos oscuros (feed).
export function AccountMenu() {
  const { user, profile, loading } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (loading) return null

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-goospe-green px-4 py-1.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
      >
        Entrar
      </Link>
    )
  }

  const label = profile?.display_name || user.email || 'Tú'
  const initial = label.charAt(0).toUpperCase()

  const Item = ({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) => (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg transition hover:bg-goospe-green/10"
      onClick={() => setOpen(false)}
    >
      <Icon size={17} strokeWidth={1.75} className="text-fg-soft" /> {children}
    </Link>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-goospe-gradient text-sm font-bold text-white shadow ring-1 ring-white/40"
        aria-label="Cuenta"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-line">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-fg">{label}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Item href="/perfil" icon={User}>Mi perfil</Item>
          <Item href="/saved" icon={Heart}>Mis guardados</Item>
          <Item href="/panel" icon={Store}>Panel de negocio</Item>
          <Item href="/eventos" icon={Calendar}>Eventos</Item>
          <Item href="/onboarding" icon={Sparkles}>Mis gustos</Item>
          {profile?.is_admin && (
            <>
              <Item href="/admin/fotos" icon={ShieldCheck}>Moderar fotos</Item>
              <Item href="/admin/contenido" icon={ShieldCheck}>Moderar contenido</Item>
            </>
          )}
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-sm text-fg transition hover:bg-goospe-green/10"
          >
            {theme === 'dark'
              ? <><Sun size={17} strokeWidth={1.75} className="text-fg-soft" /> Modo claro</>
              : <><Moon size={17} strokeWidth={1.75} className="text-fg-soft" /> Modo oscuro</>}
          </button>
          <form action={signout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-500/10"
            >
              <LogOut size={17} strokeWidth={1.75} /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
