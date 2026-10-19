'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { PANEL_TABS, tabHref, type PanelTab } from '@/features/business/panel-tabs'

/** Secciones del panel como chips con scroll horizontal (tablet y móvil). */
export function PanelChips({ placeId, active, pendingReviews }: { placeId: string; active: PanelTab; pendingReviews: number }) {
  const rowRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  // El chip activo puede quedar fuera de la vista (p. ej. "Destacar"): se centra en la fila.
  useEffect(() => {
    const row = rowRef.current
    const chip = activeRef.current
    if (row && chip) row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2
  }, [active])

  return (
    <nav ref={rowRef} aria-label="Secciones del panel" className="no-scrollbar relative -mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6">
      {PANEL_TABS.map(({ key, label, icon: Icon }) => {
        const on = key === active
        return (
          <Link key={key} href={tabHref(placeId, key)} ref={on ? activeRef : undefined} aria-current={on ? 'page' : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-[13px] text-[13px] font-medium transition md:h-9 ${on ? 'bg-tint2 text-ink' : 'bg-card text-fg-soft hover:text-fg'}`}>
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" /> {label}
            {key === 'resenas' && pendingReviews > 0 && (
              <span className="rounded-full bg-goospe-green px-1.5 py-px text-[11px] text-on-brand" aria-label={`${pendingReviews} por responder`}>{pendingReviews}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
