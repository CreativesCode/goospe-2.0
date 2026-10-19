'use client'

import { useMemo, useState } from 'react'
import { categoryIcon } from '@/shared/lib/icons'
import { pill } from '@/shared/lib/ui'
import { useFavorites } from '@/hooks/useFavorites'
import { track } from '@/lib/track'
import { PlaceCard, type PlaceCardData } from '@/features/places/PlaceCard'

/**
 * Rejilla de "Mis guardados" con chips por categoría. El corazón quita el lugar de guardados
 * sin sacarlo de la lista (se puede volver a marcar); desaparece en la siguiente carga.
 */
export function SavedGrid({ places }: { places: PlaceCardData[] }) {
  const { toggle } = useFavorites()
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [cat, setCat] = useState<string | null>(null)

  const categories = useMemo(() => {
    const map = new Map<string, { emoji: string | null | undefined; n: number }>()
    for (const p of places) {
      if (!p.category_name) continue
      const cur = map.get(p.category_name)
      map.set(p.category_name, { emoji: cur?.emoji ?? p.category_emoji, n: (cur?.n ?? 0) + 1 })
    }
    return [...map].map(([name, v]) => ({ name, n: v.n, icon: categoryIcon(v.emoji) }))
  }, [places])

  const onToggle = (id: string) => {
    const saved = toggle(id)
    track(saved ? 'save' : 'unsave', { placeId: id })
    setRemoved((prev) => {
      const next = new Set(prev)
      if (saved) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const shown = cat ? places.filter((p) => p.category_name === cat) : places

  return (
    <>
      {categories.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <button onClick={() => setCat(null)} aria-pressed={cat === null} className={pill(cat === null)}>Todos</button>
          {categories.map(({ name, n, icon: Icon }) => (
            <button key={name} onClick={() => setCat(cat === name ? null : name)} aria-pressed={cat === name} className={pill(cat === name)}>
              <Icon size={15} strokeWidth={1.75} /> {name} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]">
        {shown.map((p) => (
          <PlaceCard key={p.id} place={p} imgClassName="h-[190px]" saved={!removed.has(p.id)} onToggleSave={() => onToggle(p.id)} />
        ))}
      </div>
    </>
  )
}
