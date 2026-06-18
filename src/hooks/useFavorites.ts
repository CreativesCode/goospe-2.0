'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Guardados del usuario. Con sesión → tabla `favorites` (RLS por user_id).
// Anónimo → localStorage; al iniciar sesión se migran esos guardados a la DB.
const SAVED_KEY = 'goospe:saved'

const loadLocal = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
  } catch {
    return []
  }
}
const saveLocal = (ids: string[]) => localStorage.setItem(SAVED_KEY, JSON.stringify(ids))

export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const userId = useRef<string | null>(null)
  const supabase = useRef(createClient())
  // Espejo de `ids` para que `toggle` lea el estado actual sin depender de `ids`
  // (así su identidad es estable y no re-crea callbacks del feed en cada guardado).
  const idsRef = useRef(ids)
  useEffect(() => { idsRef.current = ids }, [ids])

  useEffect(() => {
    const sb = supabase.current
    let active = true

    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!active) return

      if (!user) {
        userId.current = null
        setIds(new Set(loadLocal()))
        setReady(true)
        return
      }

      userId.current = user.id
      // Migrar guardados locales pendientes a la DB (idempotente: PK compuesta).
      const local = loadLocal()
      if (local.length) {
        await sb
          .from('favorites')
          .upsert(local.map((place_id) => ({ user_id: user.id, place_id })) as never, {
            onConflict: 'user_id,place_id',
          })
        saveLocal([])
      }
      const { data } = await sb.from('favorites').select('place_id').eq('user_id', user.id)
      if (!active) return
      const rows = (data ?? []) as { place_id: string }[]
      setIds(new Set(rows.map((r) => r.place_id)))
      setReady(true)
    }

    init()
    return () => { active = false }
  }, [])

  // Estable (deps []): lee el estado vía `idsRef`. Devuelve `true` si quedó guardado.
  const toggle = useCallback((placeId: string): boolean => {
    const uid = userId.current
    const willSave = !idsRef.current.has(placeId)

    // Optimista (sincroniza también la ref para toggles rápidos sucesivos).
    setIds((prev) => {
      const next = new Set(prev)
      willSave ? next.add(placeId) : next.delete(placeId)
      if (!uid) saveLocal([...next]) // anónimo: persistir local
      idsRef.current = next
      return next
    })

    if (uid) {
      // Persistencia en DB en segundo plano (no bloquea la UI optimista).
      const sb = supabase.current
      void (willSave
        ? sb.from('favorites').upsert({ user_id: uid, place_id: placeId } as never, { onConflict: 'user_id,place_id' })
        : sb.from('favorites').delete().eq('user_id', uid).eq('place_id', placeId))
    }
    return willSave
  }, [])

  return { ids, ready, isSaved: (id: string) => ids.has(id), toggle }
}
