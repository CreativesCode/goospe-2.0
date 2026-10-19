'use client'

import type { LucideIcon } from 'lucide-react'
import { LIKE_ICON, VIBE_ICON } from '@/shared/lib/icons'
import { eyebrow } from '@/shared/lib/ui'

export const LIKES = [
  { v: 'comer', label: 'Comer' },
  { v: 'cafe', label: 'Café' },
  { v: 'beber', label: 'Bares' },
  { v: 'noche', label: 'Salir de noche' },
  { v: 'eventos', label: 'Eventos' },
]
export const VIBES = [
  { v: 'tranquilo', label: 'Tranquilo' },
  { v: 'romántico', label: 'Romántico' },
  { v: 'carrete', label: 'Carrete' },
  { v: 'familiar', label: 'Familiar' },
  { v: 'para trabajar', label: 'Para trabajar' },
  { v: 'al aire libre', label: 'Al aire libre' },
]
export const BUDGETS = [
  { v: '1', label: 'Económico' }, { v: '2', label: 'Medio' }, { v: '3', label: 'Alto' }, { v: '4', label: 'Premium' },
]
export const GENDERS = [
  { v: 'female', label: 'Mujer' }, { v: 'male', label: 'Hombre' }, { v: 'other', label: 'Prefiero no decir' },
]

/** Estado común de todas las opciones: seleccionada = verde de marca con texto oscuro. */
const choice = (on: boolean) =>
  `border-[1.5px] font-medium transition ${
    on ? 'border-goospe-green bg-goospe-green text-on-brand' : 'border-line bg-card text-fg-soft hover:text-fg'
  }`

type Option = { v: string; label: string }
type ChoiceProps = { label: string; active: boolean; onClick: () => void }

/** Tile de 96 px con el icono arriba y la etiqueta abajo ("¿Qué te gusta hacer?"). */
function LikeTile({ label, icon: Icon, active, onClick }: ChoiceProps & { icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-24 flex-col items-start justify-between rounded-[20px] p-3.5 text-left text-[15px] ${choice(active)}`}
    >
      {Icon ? <Icon size={22} strokeWidth={1.75} /> : <span />}
      {label}
    </button>
  )
}

/** Chip tipo píldora; `tall` = 44 px (ambientes), si no 40 px (género). */
function ChoiceChip({ label, icon: Icon, active, onClick, tall = false }: ChoiceProps & { icon?: LucideIcon; tall?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full text-sm ${tall ? 'h-11 px-4' : 'h-10 px-[15px]'} ${choice(active)}`}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      {label}
    </button>
  )
}

/** Tile de presupuesto: símbolo ($…$$$$) y etiqueta. */
function BudgetTile({ symbol, label, active, onClick }: ChoiceProps & { symbol: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl ${choice(active)}`}
    >
      <span aria-hidden className="text-base">{symbol}</span>
      <span className="max-w-full truncate px-1 text-xs font-normal">{label}</span>
    </button>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={eyebrow}>{title}</h2>
      {children}
    </section>
  )
}

type ChoicesProps = {
  likes: Set<string>
  budget: string
  gender: string
  onToggle: (v: string) => void
  onBudget: (v: string) => void
  onGender: (v: string) => void
}

/** Columna derecha del onboarding: gustos, ambientes, presupuesto y género. */
export function OnboardingChoices({ likes, budget, gender, onToggle, onBudget, onGender }: ChoicesProps) {
  const chips = (list: Option[], icons: Record<string, LucideIcon> | null, isOn: (v: string) => boolean, pick: (v: string) => void) =>
    list.map((o) => (
      <ChoiceChip key={o.v} label={o.label} icon={icons?.[o.v]} tall={!!icons} active={isOn(o.v)} onClick={() => pick(o.v)} />
    ))

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <Section title="¿Qué te gusta hacer?">
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,130px),1fr))] gap-2.5">
          {LIKES.map((o) => (
            <LikeTile key={o.v} label={o.label} icon={LIKE_ICON[o.v]} active={likes.has(o.v)} onClick={() => onToggle(o.v)} />
          ))}
        </div>
      </Section>

      <Section title="¿Qué ambiente buscas?">
        <div className="mt-3 flex flex-wrap gap-2">{chips(VIBES, VIBE_ICON, (v) => likes.has(v), onToggle)}</div>
      </Section>

      <Section title="¿Presupuesto típico?">
        <div className="mt-3 grid grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <BudgetTile key={b.v} symbol={'$'.repeat(Number(b.v))} label={b.label} active={budget === b.v} onClick={() => onBudget(b.v)} />
          ))}
        </div>
      </Section>

      <Section title={<>¿Con qué género te identificas? <span className="font-normal normal-case tracking-normal">(opcional)</span></>}>
        <div className="mt-3 flex flex-wrap gap-2">{chips(GENDERS, null, (v) => gender === v, onGender)}</div>
      </Section>
    </div>
  )
}
