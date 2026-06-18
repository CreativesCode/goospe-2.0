'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { submitReview, deleteOwnReview } from '@/actions/reviews'
import { toast } from '@/shared/components/toast'

type Review = { id: string; user_id: string; rating: number; body: string | null; created_at: string }
type Stats = { rating: number; reviews_count: number }

const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${Number(value).toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value)
        return (
          <Star
            key={n}
            size={size}
            strokeWidth={1.75}
            className={on ? 'text-goospe-green' : 'text-muted/40'}
            fill={on ? 'currentColor' : 'none'}
          />
        )
      })}
    </span>
  )
}

export function PlaceReviews({ placeId }: { placeId: string }) {
  const pathname = usePathname()
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
    if (rating < 1) { toast.error('Elige una calificación'); return }
    setSaving(true)
    const fd = new FormData()
    fd.set('place_id', placeId)
    fd.set('rating', String(rating))
    fd.set('body', body)
    const res = await submitReview(fd)
    setSaving(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success('¡Gracias por tu reseña!')
    await load()
  }

  async function onDelete() {
    if (!window.confirm('¿Eliminar tu reseña?')) return
    const fd = new FormData()
    fd.set('place_id', placeId)
    const res = await deleteOwnReview(fd)
    if (res?.error) { toast.error(res.error); return }
    setRating(0); setBody('')
    toast.success('Reseña eliminada')
    await load()
  }

  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Reseñas</h2>
        {stats.reviews_count > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-fg">
            <Stars value={stats.rating} />
            <strong>{Number(stats.rating).toFixed(1)}</strong>
            <span className="text-muted">· {stats.reviews_count} {stats.reviews_count === 1 ? 'reseña' : 'reseñas'}</span>
          </span>
        )}
      </div>

      {/* formulario / login */}
      {userId === null && !loading ? (
        <div className="mb-6 rounded-xl bg-goospe-green/5 p-4 text-sm text-fg">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-medium text-goospe-green hover:underline">Inicia sesión</Link> para dejar tu reseña.
        </div>
      ) : userId ? (
        <form onSubmit={onSubmit} className="mb-8 rounded-xl border border-line bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-fg">{own ? 'Tu reseña' : 'Deja tu reseña'}</p>
          <div className="mb-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = n <= (hover || rating)
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className={`transition ${on ? 'text-goospe-green' : 'text-muted/40'}`}
                  aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                  aria-pressed={n === rating}
                >
                  <Star size={26} strokeWidth={1.75} fill={on ? 'currentColor' : 'none'} />
                </button>
              )
            })}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="¿Cómo fue tu experiencia? (opcional)"
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-60">
              {saving ? 'Enviando…' : own ? 'Actualizar' : 'Publicar reseña'}
            </button>
            {own && (
              <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">Eliminar</button>
            )}
          </div>
        </form>
      ) : null}

      {/* lista */}
      {loading ? (
        <p className="text-sm text-muted">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay reseñas. ¡Sé el primero!</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg">
                  {names[r.user_id] ?? 'Usuario'}{r.user_id === userId && <span className="ml-1 text-xs text-goospe-green">(tú)</span>}
                </span>
                <span className="text-xs text-muted">{fmtDate(r.created_at)}</span>
              </div>
              <Stars value={r.rating} size={14} />
              {r.body && <p className="mt-2 text-sm text-fg-soft">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
