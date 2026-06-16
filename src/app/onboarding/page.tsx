'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboarding } from '@/actions/onboarding'

const LIKES = [
  { v: 'comer', label: '🍽️ Comer' },
  { v: 'cafe', label: '☕ Café' },
  { v: 'beber', label: '🍸 Bares' },
  { v: 'noche', label: '🌙 Salir de noche' },
  { v: 'eventos', label: '🎫 Eventos' },
]
const VIBES = [
  { v: 'tranquilo', label: '🧘 Tranquilo' },
  { v: 'romántico', label: '💕 Romántico' },
  { v: 'carrete', label: '🎉 Carrete' },
  { v: 'familiar', label: '👨‍👩‍👧 Familiar' },
  { v: 'para trabajar', label: '💻 Para trabajar' },
  { v: 'al aire libre', label: '🌲 Al aire libre' },
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

  const Chip = ({ v, label }: { v: string; label: string }) => (
    <button
      type="button"
      onClick={() => toggle(v)}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        likes.has(v) ? 'bg-white text-goospe-green-dark shadow' : 'bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      {label}
    </button>
  )

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

  return (
    <main className="min-h-[100dvh] bg-goospe-gradient">
      <div className="mx-auto max-w-xl px-5 py-12">
        <img src="/brand/logo-white.svg" alt="Goospe" className="mb-8 h-7" />
        <h1 className="text-3xl font-medium text-white">Cuéntanos qué te gusta</h1>
        <p className="mt-1 text-white/80">Para decidirte mejor a dónde ir. Toma 10 segundos.</p>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/70">¿Qué te gusta hacer?</h2>
          <div className="flex flex-wrap gap-2">{LIKES.map((c) => <Chip key={c.v} {...c} />)}</div>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/70">¿Qué ambiente buscas?</h2>
          <div className="flex flex-wrap gap-2">{VIBES.map((c) => <Chip key={c.v} {...c} />)}</div>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/70">¿Presupuesto típico?</h2>
          <div className="flex gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b.v}
                type="button"
                onClick={() => setBudget(budget === b.v ? '' : b.v)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                  budget === b.v ? 'bg-white text-goospe-green-dark shadow' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </section>

        {error && <p className="mt-6 rounded-lg bg-red-500/20 p-3 text-white">{error}</p>}

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={onSubmit}
            disabled={saving}
            className="rounded-full bg-white px-8 py-3 font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Empezar a descubrir'}
          </button>
          <button onClick={() => router.push('/feed')} className="text-sm text-white/70 hover:text-white">
            Omitir
          </button>
        </div>
      </div>
    </main>
  )
}
