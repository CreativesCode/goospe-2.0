'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadPlacePhoto } from '@/actions/photos'
import { UploadStatusList, useImageUploads } from '@/shared/components/upload-status'
import { RESIZE_PRESETS } from '@/lib/image-resize'

// Subida de foto por el usuario. Queda en revisión (status='pending') hasta que un admin
// la apruebe. Se muestra sólo a usuarios con sesión.
export function PhotoUpload({ placeId }: { placeId: string }) {
  const pathname = usePathname()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const uploads = useImageUploads()
  const busy = uploads.busy
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setMsg(null)
    // Se optimiza en el navegador antes de subir; el error de cada archivo lo muestra la lista.
    const ok = await uploads.uploadEach([file], RESIZE_PRESETS.photo, (f) => {
      const fd = new FormData()
      fd.set('place_id', placeId)
      fd.set('file', f)
      return uploadPlacePhoto(fd)
    })
    if (ok) setMsg({ ok: true, text: '¡Gracias! Tu foto quedó en revisión y aparecerá al aprobarse.' })
  }

  // Mientras se resuelve la sesión no mostramos nada (evita el flash botón→login).
  if (authed === null) return null

  if (authed === false) {
    return (
      <p className="mt-3 text-sm text-fg-soft">
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-medium text-ink hover:underline">Inicia sesión</Link> para aportar fotos de este lugar.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-goospe-green/40 px-4 py-2 text-sm font-medium text-ink transition hover:bg-tint">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          disabled={busy}
          className="hidden"
        />
        <Camera size={16} strokeWidth={1.75} /> Aportar una foto
      </label>
      <UploadStatusList items={uploads.items} className="mt-2 max-w-sm" />
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? 'text-ink' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  )
}
