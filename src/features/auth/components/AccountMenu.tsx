'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { signout } from '@/actions/auth'

// Indicador de sesión para el feed: avatar con inicial + menú (Guardados / Cerrar sesión).
// Sin sesión muestra un botón "Entrar". Pensado sobre fondos oscuros (feed).
export function AccountMenu() {
  const { user, profile, loading } = useAuth()
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
        className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/30"
      >
        Entrar
      </Link>
    )
  }

  const label = profile?.display_name || user.email || 'Tú'
  const initial = label.charAt(0).toUpperCase()

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
        <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="truncate text-sm font-medium text-goospe-gray">{label}</p>
            <p className="truncate text-xs text-goospe-gray/50">{user.email}</p>
          </div>
          <Link
            href="/saved"
            className="block px-4 py-2.5 text-sm text-goospe-gray transition hover:bg-goospe-green/10"
            onClick={() => setOpen(false)}
          >
            ❤️ Mis guardados
          </Link>
          <Link
            href="/panel"
            className="block px-4 py-2.5 text-sm text-goospe-gray transition hover:bg-goospe-green/10"
            onClick={() => setOpen(false)}
          >
            🏪 Panel de negocio
          </Link>
          <Link
            href="/eventos"
            className="block px-4 py-2.5 text-sm text-goospe-gray transition hover:bg-goospe-green/10"
            onClick={() => setOpen(false)}
          >
            📅 Eventos
          </Link>
          {profile?.is_admin && (
            <Link
              href="/admin/fotos"
              className="block px-4 py-2.5 text-sm text-goospe-gray transition hover:bg-goospe-green/10"
              onClick={() => setOpen(false)}
            >
              🛡️ Moderar fotos
            </Link>
          )}
          <form action={signout}>
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
