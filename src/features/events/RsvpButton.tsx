'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toggleRsvp } from '@/actions/events'
import { track } from '@/lib/track'
import { toast } from '@/shared/components/toast'

export function RsvpButton({ eventId }: { eventId: string }) {
  const [going, setGoing] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      setAuthed(!!user)
      if (!user) return
      const { data } = await sb
        .from('event_rsvps')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle()
      setGoing(!!data)
    })
  }, [eventId])

  async function onClick() {
    if (authed === false) { window.location.href = '/login?next=/events'; return }
    setBusy(true)
    const fd = new FormData()
    fd.set('event_id', eventId)
    fd.set('status', 'going')
    const res = await toggleRsvp(fd)
    setBusy(false)
    if (res?.error) { toast.error(res.error); return }
    if (res.going) { track('rsvp', { eventId }); toast.success('¡Listo! Te esperamos') }
    setGoing(!!res.going)
  }

  return (
    <button
      onClick={onClick}
      disabled={busy || authed === null}
      aria-pressed={going}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        going
          ? 'bg-goospe-green text-white'
          : 'border border-goospe-green/40 text-goospe-green-dark hover:bg-goospe-green/10'
      }`}
    >
      {busy ? 'Guardando…' : going ? <><Check size={15} strokeWidth={2} /> Asistiré</> : 'Me interesa'}
    </button>
  )
}
