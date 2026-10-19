'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboarding } from '@/actions/onboarding'
import { OnboardingChoices } from './OnboardingChoices'

export type OnboardingInitial = { likes: string[]; budget: string; gender: string }

const submitBtn = 'h-[52px] rounded-full bg-goospe-green font-medium text-on-brand transition hover:brightness-105 disabled:opacity-60'
const skipBtn = 'h-[52px] shrink-0 px-[18px] text-[15px] text-fg-soft transition hover:text-fg'

type ActionsProps = {
  editing: boolean
  saving: boolean
  error: string | null
  count: number
  onSubmit: () => void
  onSkip: () => void
}

function ErrorNote({ id, error, className = '' }: { id: string; error: string | null; className?: string }) {
  if (!error) return null
  return <p id={id} role="alert" className={`rounded-xl bg-red-500/10 p-3 text-sm text-red-600 ${className}`}>{error}</p>
}

/** Cabecera de la columna izquierda: isotipo, badge, titular y bajada. */
function Intro({ editing }: { editing: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <img src="/brand/isotipo-color.svg" alt="Goospe" className="h-7" />
        <span className="rounded-full bg-tint px-[11px] py-[5px] text-xs font-medium text-ink">10 segundos</span>
      </div>
      <h1 className="mt-6 text-[clamp(36px,4.4vw,60px)] font-light leading-none tracking-[-0.03em] text-fg">
        {editing ? 'Actualiza' : 'Cuéntanos'} <span className="font-medium">qué te gusta</span>
      </h1>
      <p className="mt-3.5 max-w-[380px] text-[17px] leading-[1.5] text-fg-soft">
        Para decidirte mejor a dónde ir. Puedes cambiarlo cuando quieras desde tu perfil.
      </p>
    </>
  )
}

/** Acciones en tablet/web: van bajo el titular, en la columna sticky. */
function DesktopActions({ editing, saving, error, onSubmit, onSkip }: ActionsProps) {
  return (
    <div className="hidden md:block">
      <ErrorNote id="onb-error" error={error} className="mt-6" />
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          aria-describedby={error ? 'onb-error' : undefined}
          className={`${submitBtn} px-7`}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Empezar a descubrir'}
        </button>
        <button type="button" onClick={onSkip} className={skipBtn}>{editing ? 'Cancelar' : 'Omitir'}</button>
      </div>
    </div>
  )
}

/** Acciones en móvil: barra fija abajo con el contador de elegidos. */
function MobileBar({ editing, saving, error, count, onSubmit, onSkip }: ActionsProps) {
  const start = `Empezar · ${count} ${count === 1 ? 'elegido' : 'elegidos'}`
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/[0.92] px-5 pb-[calc(20px+var(--sab))] pt-3 backdrop-blur-md md:hidden">
      <ErrorNote id="onb-error-mobile" error={error} className="mb-3" />
      <div className="flex gap-2">
        <button type="button" onClick={onSkip} className={skipBtn}>{editing ? 'Cancelar' : 'Omitir'}</button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          aria-describedby={error ? 'onb-error-mobile' : undefined}
          className={`${submitBtn} min-w-0 flex-1`}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : start}
        </button>
      </div>
    </div>
  )
}

/**
 * Formulario de gustos. `initial` trae lo ya guardado (profiles.onboarding): al entrar desde
 * "Mis gustos" se precarga, así guardar no borra lo anterior (incluido el género).
 */
export function OnboardingForm({ initial }: { initial: OnboardingInitial | null }) {
  const router = useRouter()
  const editing = !!initial && initial.likes.length > 0
  const [likes, setLikes] = useState<Set<string>>(new Set(initial?.likes ?? []))
  const [budget, setBudget] = useState(initial?.budget ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (v: string) =>
    setLikes((prev) => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n })

  async function onSubmit() {
    if (likes.size === 0) { setError('Elige al menos una cosa'); return }
    setSaving(true); setError(null)
    const fd = new FormData()
    likes.forEach((l) => fd.append('likes', l))
    if (budget) fd.set('budget', budget)
    if (gender) fd.set('gender', gender)
    const res = await saveOnboarding(fd)
    setSaving(false)
    if (res?.error) setError(res.error)
    else router.push(editing ? '/profile' : '/feed')
  }

  const actions: ActionsProps = {
    editing, saving, error, count: likes.size, onSubmit, onSkip: () => router.push(editing ? '/profile' : '/feed'),
  }

  return (
    <main className="min-h-[100dvh] bg-goospe-paper">
      {/* En móvil el padding inferior deja sitio a la barra fija de acciones. */}
      <div className="mx-auto grid max-w-[1180px] items-start gap-12 px-4 pb-[calc(124px+var(--sab))] pt-[calc(28px+var(--sat))] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:px-6 md:py-16 lg:px-8">
        <div className="md:sticky md:top-14">
          <Intro editing={editing} />
          <DesktopActions {...actions} />
        </div>
        <OnboardingChoices
          likes={likes}
          budget={budget}
          gender={gender}
          onToggle={toggle}
          onBudget={(v) => setBudget(budget === v ? '' : v)}
          onGender={(v) => setGender(gender === v ? '' : v)}
        />
      </div>
      <MobileBar {...actions} />
    </main>
  )
}
