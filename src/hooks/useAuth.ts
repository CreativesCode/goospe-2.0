'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type AuthState = { user: User | null; profile: Profile | null; loading: boolean }

/**
 * Sesión compartida en un único store-singleton. Antes cada consumidor de useAuth (AppNav,
 * AccountMenu, …) montaba su propio `getUser()` + fetch de `profiles` + `onAuthStateChange`
 * → en cada página y por cada componente. Ahora se resuelve UNA vez por carga de app y se
 * comparte/cachea entre todos los consumidores y entre navegaciones (sin parpadeo ni refetch).
 * La API pública del hook no cambia.
 */
let state: AuthState = { user: null, profile: null, loading: true }
const listeners = new Set<() => void>()
let started = false

const emit = () => listeners.forEach((l) => l())
const setState = (next: Partial<AuthState>) => { state = { ...state, ...next }; emit() }

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const supabase = createClient()

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setState({ profile: data })
  }

  supabase.auth.getUser().then(({ data: { user } }) => {
    setState({ user, loading: false })
    if (user) loadProfile(user.id)
  })

  // Una sola suscripción para toda la app (vive lo que vive la pestaña; no se desuscribe).
  supabase.auth.onAuthStateChange((_e, session) => {
    const u = session?.user ?? null
    setState({ user: u, loading: false, profile: u ? state.profile : null })
    if (u) loadProfile(u.id)
  })
}

const subscribe = (cb: () => void) => {
  start()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = () => state
const SERVER_STATE: AuthState = { user: null, profile: null, loading: true }

export function useAuth() {
  // El store solo crea un objeto nuevo en cada cambio → referencia estable entre renders.
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE)
}
