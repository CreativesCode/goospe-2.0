'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { migrateLocalFavorites } from '@/hooks/useFavorites'

/**
 * Sube a la cuenta los guardados hechos sin sesión (localStorage) y refresca la página.
 * Se monta en /saved: esa página se renderiza en el servidor y no usa `useFavorites`, así
 * que si el login aterrizaba aquí los guardados anónimos nunca se migraban.
 */
export function FavoritesMigrator() {
  const router = useRouter()
  useEffect(() => {
    let active = true
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !active) return
      const moved = await migrateLocalFavorites(sb, user.id)
      if (moved > 0 && active) router.refresh()
    })
    return () => { active = false }
  }, [router])
  return null
}
