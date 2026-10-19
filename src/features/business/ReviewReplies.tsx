'use client'

import { useState } from 'react'
import { Star, Sparkles, BadgeCheck, AlertTriangle } from 'lucide-react'
import { suggestReviewReply } from '@/actions/ai-assist'
import { deleteReviewReply, saveReviewReply } from '@/actions/review-replies'
import { toast } from '@/shared/components/toast'
import { fmtInZone } from '@/lib/tz'
import { REPLY_MAX } from '@/features/business/owner-schemas'
import { cardClass, ghostBtn, hintClass, inputSm, linkBtn, primaryBtn, sectionTitle } from '@/features/business/ui'

export type OwnerReview = {
  id: string
  rating: number
  body: string | null
  created_at: string
  author: string
  owner_reply: string | null
  owner_replied_at: string | null
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= rating
        return <Star key={n} size={14} strokeWidth={1.75} className={on ? 'text-ink' : 'text-muted/40'} fill={on ? 'currentColor' : 'none'} />
      })}
    </span>
  )
}

/** Una reseña con su respuesta. `plain`: fila sin caja, separada por una línea (tarjeta del Resumen). */
export function ReviewRow({ placeId, r, timeZone, plain = false }: { placeId: string; r: OwnerReview; timeZone: string | null; plain?: boolean }) {
  const [published, setPublished] = useState(r.owner_reply)
  const [draft, setDraft] = useState<string | null>(null) // null = editor cerrado
  const [busy, setBusy] = useState<'ai' | 'save' | 'delete' | null>(null)
  const fmt = (s: string) => fmtInZone(s, timeZone, { day: 'numeric', month: 'short' })
  const form = () => { const fd = new FormData(); fd.set('place_id', placeId); fd.set('review_id', r.id); return fd }

  async function suggest() {
    setBusy('ai')
    const res = await suggestReviewReply(form())
    setBusy(null)
    if (res?.error) { toast.error(res.error); return }
    setDraft((res.reply ?? '').slice(0, REPLY_MAX))
  }

  async function publish() {
    const fd = form()
    fd.set('body', draft ?? '')
    setBusy('save')
    const res = await saveReviewReply(fd)
    setBusy(null)
    if (res?.error) { toast.error(res.error); return }
    setPublished(res.reply ?? draft)
    setDraft(null)
    toast.success('Respuesta publicada en tu ficha')
  }

  async function remove() {
    if (!window.confirm('¿Borrar tu respuesta pública a esta reseña?')) return
    setBusy('delete')
    const res = await deleteReviewReply(form())
    setBusy(null)
    if (res?.error) { toast.error(res.error); return }
    setPublished(null)
    toast.success('Respuesta eliminada')
  }

  const critical = r.rating <= 2
  return (
    <li className={plain ? 'border-t border-line py-3 last:pb-0' : `rounded-xl border p-3 ${critical ? 'border-amber-500/50 bg-amber-500/5' : 'border-line'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-fg"><Stars rating={r.rating} /> {r.author}</span>
        <span className="text-xs text-muted">{fmt(r.created_at)}</span>
      </div>
      {critical && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle size={13} strokeWidth={2} /> Reseña crítica: una respuesta cuidada suele cambiar la impresión.
        </p>
      )}
      {r.body && <p className="mt-1 text-sm text-fg-soft [overflow-wrap:anywhere]">{r.body}</p>}

      {published && draft === null && (
        <div className="mt-3 rounded-lg bg-tint p-3">
          <p className="inline-flex items-center gap-1 text-xs font-medium text-ink"><BadgeCheck size={13} strokeWidth={2} /> Tu respuesta pública</p>
          <p className="mt-1 whitespace-pre-line text-sm text-fg [overflow-wrap:anywhere]">{published}</p>
          <div className="mt-2 flex flex-wrap gap-x-4">
            <button type="button" onClick={() => setDraft(published)} className={`min-h-11 ${linkBtn}`}>Editar</button>
            <button type="button" onClick={remove} disabled={busy === 'delete'} className="min-h-11 text-sm text-red-600 hover:underline disabled:opacity-60 dark:text-red-400">Borrar</button>
          </div>
        </div>
      )}

      {draft !== null && (
        <div className="mt-3 rounded-lg bg-tint p-3">
          <label className="block text-xs font-medium text-fg-soft">
            Respuesta pública
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={REPLY_MAX} className={`mt-1 ${inputSm}`} />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={publish} disabled={busy !== null || draft.trim().length < 2} className={primaryBtn}>
              {busy === 'save' ? 'Publicando…' : published ? 'Guardar cambios' : 'Publicar'}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy !== null} className={ghostBtn}>Cancelar</button>
            <button type="button" onClick={suggest} disabled={busy !== null} className={`min-h-11 ${linkBtn}`}>
              <Sparkles size={14} strokeWidth={1.75} /> {busy === 'ai' ? 'Pensando…' : 'Sugerir con IA'}
            </button>
            <span className={`ml-auto ${hintClass}`}>{draft.length}/{REPLY_MAX}</span>
          </div>
        </div>
      )}

      {!published && draft === null && (
        <div className="mt-2 flex flex-wrap gap-x-4">
          <button type="button" onClick={() => setDraft('')} className={`min-h-11 ${linkBtn}`}>Responder</button>
          <button type="button" onClick={suggest} disabled={busy !== null} className={`min-h-11 ${linkBtn}`}>
            {busy === 'ai' ? 'Pensando…' : <><Sparkles size={15} strokeWidth={1.75} /> Sugerir respuesta</>}
          </button>
        </div>
      )}
    </li>
  )
}

/** Reseñas del lugar con respuesta pública del negocio (escrita a mano o a partir de la sugerencia de la IA). */
export function ReviewReplies({ placeId, reviews, timeZone }: { placeId: string; reviews: OwnerReview[]; timeZone: string | null }) {
  return (
    <section id="resenas" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={sectionTitle}>Reseñas</h2>
      <p className={`mb-4 ${hintClass}`}>Tu respuesta se muestra bajo la reseña en tu ficha, con el sello “Respuesta del negocio”.</p>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay reseñas de tu lugar.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => <ReviewRow key={r.id} placeId={placeId} r={r} timeZone={timeZone} />)}
        </ul>
      )}
    </section>
  )
}
