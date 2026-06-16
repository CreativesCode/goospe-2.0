'use client'

import { useState } from 'react'
import { suggestReviewReply } from '@/actions/ai-assist'

type Review = { id: string; rating: number; body: string | null; created_at: string }
const fmt = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })

function ReviewRow({ placeId, r }: { placeId: string; r: Review }) {
  const [reply, setReply] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function suggest() {
    setBusy(true)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('review_id', r.id)
    const res = await suggestReviewReply(fd)
    setBusy(false)
    if (res?.error) { alert(res.error); return }
    setReply(res.reply ?? '')
  }

  return (
    <li className="rounded-xl border border-black/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-goospe-green">{'★'.repeat(r.rating)}<span className="text-goospe-gray/20">{'★'.repeat(5 - r.rating)}</span></span>
        <span className="text-xs text-goospe-gray/40">{fmt(r.created_at)}</span>
      </div>
      {r.body && <p className="mt-1 text-sm text-goospe-gray/80">{r.body}</p>}

      {reply === null ? (
        <button onClick={suggest} disabled={busy}
          className="mt-2 text-sm font-medium text-goospe-green hover:underline disabled:opacity-60">
          {busy ? 'Pensando…' : '✨ Sugerir respuesta'}
        </button>
      ) : (
        <div className="mt-2 rounded-lg bg-goospe-green/5 p-3">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
            className="w-full resize-none rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-goospe-green" />
          <button
            onClick={() => { navigator.clipboard?.writeText(reply); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="mt-1 text-xs font-medium text-goospe-green hover:underline">
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
      )}
    </li>
  )
}

export function ReviewReplies({ placeId, reviews }: { placeId: string; reviews: Review[] }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-medium text-goospe-gray">Reseñas</h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-goospe-gray/50">Aún no hay reseñas de tu lugar.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => <ReviewRow key={r.id} placeId={placeId} r={r} />)}
        </ul>
      )}
    </section>
  )
}
