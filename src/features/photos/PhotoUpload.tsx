'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadPlacePhoto } from '@/actions/photos'

// Subida de foto por el usuario. Queda en revisión (status='pending') hasta que un admin
// la apruebe. Se muestra sólo a usuarios con sesión.
export function PhotoUpload({ placeId }: { placeId: string }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('file', file)
    const res = await uploadPlacePhoto(fd)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
    if (res?.error) setMsg({ ok: false, text: res.error })
    else setMsg({ ok: true, text: '¡Gracias! Tu foto quedó en revisión y aparecerá al aprobarse.' })
  }

  if (authed === false) {
    return (
      <p className="mt-3 text-sm text-goospe-gray/60">
        <Link href="/login?next=/places" className="font-medium text-goospe-green hover:underline">Inicia sesión</Link> para aportar fotos de este lugar.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-goospe-green/40 px-4 py-2 text-sm font-medium text-goospe-green-dark transition hover:bg-goospe-green/10">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          disabled={busy}
          className="hidden"
        />
        {busy ? 'Subiendo…' : '📷 Aportar una foto'}
      </label>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  )
}
