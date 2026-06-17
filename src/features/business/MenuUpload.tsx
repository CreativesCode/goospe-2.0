'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadMenu, clearMenu } from '@/actions/menu'

export function MenuUpload({ placeId, hasMenu }: { placeId: string; hasMenu: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('file', file)
    const res = await uploadMenu(fd)
    setBusy(false)
    if (ref.current) ref.current.value = ''
    if (res?.error) setMsg({ ok: false, text: res.error })
    else { setMsg({ ok: true, text: `Carta leída (${res.count} secciones). Ya aparece en tu ficha.` }); router.refresh() }
  }

  async function onClear() {
    const fd = new FormData(); fd.set('place_id', placeId)
    await clearMenu(fd); router.refresh()
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-goospe-gray">Carta / Menú</h2>
        <span className="rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark">IA</span>
      </div>
      <p className="mt-1 text-sm text-goospe-gray/60">
        Sube una foto de tu carta y la IA la convierte en menú digital en tu ficha.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-goospe-gradient px-4 py-2 text-sm font-medium text-white shadow">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={busy} className="hidden" />
          {busy ? 'Leyendo carta…' : hasMenu ? '📷 Actualizar carta' : '📷 Subir carta'}
        </label>
        {hasMenu && <button onClick={onClear} className="text-sm text-red-600 hover:underline">Quitar</button>}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600'}`}>{msg.text}</p>}
    </section>
  )
}
