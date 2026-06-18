'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboarding } from '@/actions/onboarding'
import { Chip } from '@/shared/components/chip'
import { LIKE_ICON, VIBE_ICON } from '@/shared/lib/icons'

const LIKES = [
  { v: 'comer', label: 'Comer' },
  { v: 'cafe', label: 'Café' },
  { v: 'beber', label: 'Bares' },
  { v: 'noche', label: 'Salir de noche' },
  { v: 'eventos', label: 'Eventos' },
]
const VIBES = [
  { v: 'tranquilo', label: 'Tranquilo' },
  { v: 'romántico', label: 'Romántico' },
  { v: 'carrete', label: 'Carrete' },
  { v: 'familiar', label: 'Familiar' },
  { v: 'para trabajar', label: 'Para trabajar' },
  { v: 'al aire libre', label: 'Al aire libre' },
]
const BUDGETS = [
  { v: '1', label: '$' }, { v: '2', label: '$$' }, { v: '3', label: '$$$' }, { v: '4', label: '$$$$' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [likes, setLikes] = useState<Set<string>>(new Set())
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (v: string) =>
    setLikes((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })

  async function onSubmit() {
    if (likes.size === 0) { setError('Elige al menos una cosa'); return }
    setSaving(true); setError(null)
    const fd = new FormData()
    likes.forEach((l) => fd.append('likes', l))
    if (budget) fd.set('budget', budget)
    const res = await saveOnboarding(fd)
    setSaving(false)
    if (res?.error) setError(res.error)
    else router.push('/feed')
  }

  const sectionLabel = 'mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted'

  return (
    <main className="min-h-[100dvh] bg-goospe-paper">
      <div className="mx-auto max-w-xl px-5 py-12">
        <div className="flex items-center justify-between">
          <img src="/brand/isotipo-color.svg" alt="Goospe" className="h-6" />
          <span className="rounded-full bg-goospe-green/10 px-3 py-1.5 text-xs font-medium text-goospe-green-dark">10 segundos</span>
        </div>

        <h1 className="mt-6 text-3xl font-light leading-tight text-fg sm:text-4xl">
          Cuéntanos <span className="font-medium">qué te gusta</span>
        </h1>
        <p className="mt-2 text-fg-soft">Para decidirte mejor a dónde ir.</p>

        <section className="mt-8">
          <h2 className={sectionLabel}>¿Qué te gusta hacer?</h2>
          <div className="flex flex-wrap gap-2">
            {LIKES.map((c) => (
              <Chip key={c.v} label={c.label} icon={LIKE_ICON[c.v]} active={likes.has(c.v)} onClick={() => toggle(c.v)} />
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className={sectionLabel}>¿Qué ambiente buscas?</h2>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((c) => (
              <Chip key={c.v} label={c.label} icon={VIBE_ICON[c.v]} active={likes.has(c.v)} onClick={() => toggle(c.v)} />
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className={sectionLabel}>¿Presupuesto típico?</h2>
          <div className="flex gap-2">
            {BUDGETS.map((b) => (
              <Chip key={b.v} label={b.label} active={budget === b.v} onClick={() => setBudget(budget === b.v ? '' : b.v)} />
            ))}
          </div>
        </section>

        {error && <p id="onb-error" role="alert" className="mt-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={onSubmit}
            disabled={saving}
            aria-describedby={error ? 'onb-error' : undefined}
            className="rounded-full bg-goospe-green px-8 py-3 font-medium text-white shadow-sm transition hover:bg-goospe-green-dark disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Empezar a descubrir'}
          </button>
          <button onClick={() => router.push('/feed')} className="text-sm text-fg-soft hover:text-fg">
            Omitir
          </button>
        </div>
      </div>
    </main>
  )
}
