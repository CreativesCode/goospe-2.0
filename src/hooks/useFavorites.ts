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

  const toggle = useCallback(async (placeId: string) => {
    const uid = userId.current
    const willSave = !ids.has(placeId)

    // Optimista
    setIds((prev) => {
      const next = new Set(prev)
      willSave ? next.add(placeId) : next.delete(placeId)
      if (!uid) saveLocal([...next]) // anónimo: persistir local
      return next
    })

    if (!uid) return // anónimo termina en localStorage
    const sb = supabase.current
    if (willSave) {
      await sb.from('favorites').upsert({ user_id: uid, place_id: placeId } as never, {
        onConflict: 'user_id,place_id',
      })
    } else {
      await sb.from('favorites').delete().eq('user_id', uid).eq('place_id', placeId)
    }
  }, [ids])

  return { ids, ready, isSaved: (id: string) => ids.has(id), toggle }
}
