'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Plus } from 'lucide-react'
import { uploadMenu, clearMenu } from '@/actions/menu'
import { toast } from '@/shared/components/toast'

export function MenuUpload({ placeId, hasMenu }: { placeId: string; hasMenu: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const appendRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList, mode: 'append' | 'replace', inputEl: HTMLInputElement | null) {
    if (!files.length) return
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('mode', mode)
    Array.from(files).forEach((f) => fd.append('file', f))
    const res = await uploadMenu(fd)
    setBusy(false)
    if (inputEl) inputEl.value = ''
    if (res?.error) setMsg({ ok: false, text: res.error })
    else {
      const n = files.length
      setMsg({ ok: true, text: `${mode === 'append' ? 'Páginas añadidas' : 'Carta leída'} (${n} ${n === 1 ? 'imagen' : 'imágenes'} · ${res.count} secciones). Ya aparece en tu ficha.` })
      router.refresh()
    }
  }

  async function onClear() {
    if (!window.confirm('¿Quitar la carta de tu ficha? Tendrás que volver a subirla.')) return
    setBusy(true)
    const fd = new FormData(); fd.set('place_id', placeId)
    const res = await clearMenu(fd)
    setBusy(false)
    if (res && 'error' in res && res.error) { toast.error(res.error); return }
    toast.success('Carta quitada de tu ficha')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-fg">Carta / Menú</h2>
        <span
          title="Decídeme lee tu carta automáticamente y la convierte en menú digital"
          className="rounded-full bg-goospe-green/15 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark"
        >
          Lectura automática
        </span>
      </div>
      <p className="mt-1 text-sm text-fg-soft">
        Sube una o varias fotos de tu carta y Decídeme las convierte en menú digital. Puedes
        agregar más páginas cuando quieras.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* Subir / agregar páginas (append si ya hay carta) */}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-goospe-gradient px-4 py-2 text-sm font-medium text-white shadow">
          <input
            ref={appendRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => e.target.files && upload(e.target.files, hasMenu ? 'append' : 'replace', appendRef.current)}
            disabled={busy}
            className="hidden"
          />
          {busy ? 'Leyendo carta…' : hasMenu
            ? <><Plus size={16} strokeWidth={2} /> Agregar páginas</>
            : <><Camera size={16} strokeWidth={1.75} /> Subir carta</>}
        </label>

        {hasMenu && (
          <>
            {/* Reemplazar todo */}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-fg-soft transition hover:text-fg">
              <input
                ref={replaceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => e.target.files && upload(e.target.files, 'replace', replaceRef.current)}
                disabled={busy}
                className="hidden"
              />
              <Camera size={16} strokeWidth={1.75} /> Reemplazar
            </label>
            <button onClick={onClear} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-60">Quitar</button>
          </>
        )}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-goospe-green-dark' : 'text-red-600'}`}>{msg.text}</p>}
    </section>
  )
}
