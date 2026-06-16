'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { submitReview, deleteOwnReview } from '@/actions/reviews'

type Review = { id: string; user_id: string; rating: number; body: string | null; created_at: string }
type Stats = { rating: number; reviews_count: number }

const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

function Stars({ value, size = 'text-base' }: { value: number; size?: string }) {
  return (
    <span className={`${size} leading-none tracking-tight`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'text-goospe-green' : 'text-goospe-gray/25'}>★</span>
      ))}
    </span>
  )
}

export function PlaceReviews({ placeId }: { placeId: string }) {
  const [supabase] = useState(() => createClient())
  const [stats, setStats] = useState<Stats>({ rating: 0, reviews_count: 0 })
  const [reviews, setReviews] = useState<Review[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // form
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: st }, { data: rv }, { data: { user } }] = await Promise.all([
      supabase.from('place_stats').select('rating, reviews_count').eq('place_id', placeId).maybeSingle(),
      supabase
        .from('reviews')
        .select('id, user_id, rating, body, created_at')
        .eq('place_id', placeId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.auth.getUser(),
    ])

    const list = (rv ?? []) as unknown as Review[]
    setStats((st as unknown as Stats) ?? { rating: 0, reviews_count: 0 })
    setReviews(list)
    setUserId(user?.id ?? null)

    const ids = [...new Set(list.map((r) => r.user_id))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      const map: Record<string, string> = {}
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
        map[p.id] = p.display_name || 'Usuario'
      }
      setNames(map)
    }

    // prefill con la reseña propia si existe
    const mine = user ? list.find((r) => r.user_id === user.id) : undefined
    if (mine) { setRating(mine.rating); setBody(mine.body ?? '') }
    setLoading(false)
  }, [supabase, placeId])

  useEffect(() => { load() }, [load])

  const own = userId ? reviews.find((r) => r.user_id === userId) : undefined

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) { setMsg('Elige una calificación'); return }
    setSaving(true); setMsg(null)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('rating', String(rating))
    fd.set('body', body)
    const res = await submitReview(fd)
    setSaving(false)
    if (res?.error) setMsg(res.error)
    else { setMsg('¡Gracias por tu reseña!'); await load() }
  }

  async function onDelete() {
    const fd = new FormData()
    fd.set('place_id', placeId)
    await deleteOwnReview(fd)
    setRating(0); setBody(''); setMsg(null)
    await load()
  }

  return (
    <section className="mt-10 border-t border-black/5 pt-8">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-goospe-gray/40">Reseñas</h2>
        {stats.reviews_count > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-goospe-gray">
            <Stars value={stats.rating} />
            <strong>{Number(stats.rating).toFixed(1)}</strong>
            <span className="text-goospe-gray/50">· {stats.reviews_count} {stats.reviews_count === 1 ? 'reseña' : 'reseñas'}</span>
          </span>
        )}
      </div>

      {/* formulario / login */}
      {userId === null && !loading ? (
        <div className="mb-6 rounded-xl bg-goospe-green/5 p-4 text-sm text-goospe-gray">
          <Link href={`/login?next=/places`} className="font-medium text-goospe-green hover:underline">Inicia sesión</Link> para dejar tu reseña.
        </div>
      ) : userId ? (
        <form onSubmit={onSubmit} className="mb-8 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-goospe-gray">{own ? 'Tu reseña' : 'Deja tu reseña'}</p>
          <div className="mb-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className={`text-2xl leading-none transition ${n <= (hover || rating) ? 'text-goospe-green' : 'text-goospe-gray/25'}`}
                aria-label={`${n} estrellas`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="¿Cómo fue tu experiencia? (opcional)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-goospe-gray outline-none focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-60">
              {saving ? 'Enviando…' : own ? 'Actualizar' : 'Publicar reseña'}
            </button>
            {own && (
              <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">Eliminar</button>
            )}
            {msg && <span className="text-sm text-goospe-green-dark">{msg}</span>}
          </div>
        </form>
      ) : null}

      {/* lista */}
      {loading ? (
        <p className="text-sm text-goospe-gray/50">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-goospe-gray/50">Aún no hay reseñas. ¡Sé el primero!</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-goospe-gray">
                  {names[r.user_id] ?? 'Usuario'}{r.user_id === userId && <span className="ml-1 text-xs text-goospe-green">(tú)</span>}
                </span>
                <span className="text-xs text-goospe-gray/40">{fmtDate(r.created_at)}</span>
              </div>
              <Stars value={r.rating} size="text-sm" />
              {r.body && <p className="mt-2 text-sm text-goospe-gray/80">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
