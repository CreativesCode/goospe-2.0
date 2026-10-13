'use client'

import { useState } from 'react'
import { setNotificationMute } from '@/actions/notifications'
import { toast } from '@/shared/components/toast'
import { cardClass, hintClass, sectionTitle } from '@/features/business/ui'
import { MUTE_GROUPS, MUTE_GROUP_LABELS, type MuteGroup } from '@/features/notifications/kinds'

/** Interruptores de avisos in-app. `muted` = grupos que el usuario tiene silenciados. */
export function NotificationPrefs({ muted }: { muted: MuteGroup[] }) {
  const [state, setState] = useState(() => new Set<MuteGroup>(muted))
  const [busy, setBusy] = useState<MuteGroup | null>(null)

  async function toggle(group: MuteGroup) {
    const mute = !state.has(group)
    const fd = new FormData()
    fd.set('group', group)
    fd.set('muted', mute ? '1' : '0')
    setBusy(group)
    const res = await setNotificationMute(fd)
    setBusy(null)
    if (res?.error) { toast.error(res.error); return }
    setState((prev) => {
      const next = new Set(prev)
      if (mute) next.add(group)
      else next.delete(group)
      return next
    })
    toast.success(mute ? 'Ya no te avisaremos' : 'Te volveremos a avisar')
  }

  return (
    <section id="avisos" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={sectionTitle}>Avisos en la app</h2>
      <p className={`mb-3 ${hintClass}`}>Los avisos sobre tus reseñas, eventos a los que vas y solicitudes llegan siempre.</p>
      <ul className="divide-y divide-line">
        {MUTE_GROUPS.map((g) => {
          const on = !state.has(g)
          return (
            <li key={g} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p id={`notif-${g}`} className="text-sm font-medium text-fg">{MUTE_GROUP_LABELS[g].title}</p>
                <p className={hintClass}>{MUTE_GROUP_LABELS[g].hint}</p>
              </div>
              <button type="button" role="switch" aria-checked={on} aria-labelledby={`notif-${g}`}
                disabled={busy === g} onClick={() => toggle(g)}
                className="relative inline-flex h-11 w-14 shrink-0 items-center disabled:opacity-60">
                <span className={`h-7 w-12 rounded-full transition ${on ? 'bg-goospe-green' : 'bg-line'}`} />
                <span className={`absolute left-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
