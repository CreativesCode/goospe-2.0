'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setRsvp } from '@/actions/events'
import { track } from '@/lib/track'
import { toast } from '@/shared/components/toast'
import type { RsvpStatus } from './event-time'

/** Evento del navegador que avisa a los conteos en vivo de que cambió un RSVP. */
export const RSVP_CHANGED = 'goospe:rsvp-changed'

/**
 * Respuesta del usuario a un evento: "me interesa" (interested) o "asistiré" (going).
 * Pulsar la opción ya marcada la quita. Sin sesión, manda a iniciar sesión y vuelve aquí.
 */
export function useRsvp(eventId: string) {
  const [status, setStatus] = useState<RsvpStatus | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!alive) return
      setAuthed(!!user)
      if (!user) return
      const { data } = await sb
        .from('event_rsvps')
        .select('status')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle()
      const row = data as { status: string } | null
      if (alive) setStatus(row?.status === 'interested' ? 'interested' : row ? 'going' : null)
    })
    return () => { alive = false }
  }, [eventId])

  const choose = useCallback(async (next: RsvpStatus) => {
    if (authed === false) {
      const back = `${window.location.pathname}${window.location.search}`
      window.location.href = `/login?next=${encodeURIComponent(back)}`
      return
    }
    const target = status === next ? 'none' : next
    const fd = new FormData()
    fd.set('event_id', eventId)
    fd.set('status', target)
    setBusy(true)
    const res = await setRsvp(fd)
    setBusy(false)
    if ('error' in res) { toast.error(res.error); return }
    setStatus(res.status)
    if (res.status === 'going') {
      track('rsvp', { eventId }) // la métrica "RSVP" del dueño cuenta solo "asistiré"
      toast.success('¡Listo! Te esperamos')
    } else if (res.status === 'interested') {
      toast.success('Guardado en tus intereses')
    }
    window.dispatchEvent(new CustomEvent(RSVP_CHANGED, { detail: { eventId } }))
  }, [authed, eventId, status])

  return { status, busy, ready: authed !== null, choose }
}
