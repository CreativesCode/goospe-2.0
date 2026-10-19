import Link from 'next/link'
import { ChevronsUpDown, Inbox, MapPinPlus, Mail, Store } from 'lucide-react'
import { PhotoImg } from '@/shared/components/photo-img'
import { PANEL_TABS, tabHref, type PanelTab } from '@/features/business/panel-tabs'
import { PanelChips } from '@/features/business/PanelChips'

export type PanelNavProps = {
  placeId: string
  placeName: string
  logoUrl: string | null
  statusLabel: string
  published: boolean
  /** El usuario administra más de un lugar: el selector vuelve a "Mis lugares". */
  multiple: boolean
  active: PanelTab
  pendingReviews: number
}

// Lo que no es de un lugar en concreto vive en "Mis lugares" (/panel).
const SECONDARY = [
  { href: '/panel#solicitudes', label: 'Mis solicitudes', icon: Inbox },
  { href: '/panel/propose', label: 'Proponer un lugar', icon: MapPinPlus },
  { href: '/panel#correo', label: 'Preferencias de correo', icon: Mail },
] as const

/** Selector de negocio: logo (o icono), nombre y estado de publicación. */
function BusinessSwitcher({ placeName, logoUrl, statusLabel, published, multiple }: PanelNavProps) {
  const box = 'flex items-center gap-2.5 rounded-[18px] border border-line bg-card p-3'
  const body = (
    <>
      <PhotoImg src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" fallback={<Store size={18} strokeWidth={1.75} />} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{placeName}</span>
        <span className={`block text-xs ${published ? 'text-ink' : 'text-muted'}`}>● {statusLabel}</span>
      </span>
      {multiple && <ChevronsUpDown size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />}
    </>
  )
  if (!multiple) return <div className={box}>{body}</div>
  return (
    <Link href="/panel" aria-label={`Cambiar de lugar. Actual: ${placeName}`} className={`${box} transition hover:border-goospe-green/40`}>
      {body}
    </Link>
  )
}

/** Enlaces secundarios; en web van bajo la nav lateral y en tablet/móvil al pie del contenido. */
export function PanelSecondaryLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`text-sm ${className}`}>
      {SECONDARY.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex h-11 items-center gap-2.5 px-3 text-fg-soft transition hover:text-ink lg:h-[38px]">
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" /> {label}
        </Link>
      ))}
    </div>
  )
}

/** Lateral del panel (web): selector de negocio, secciones y enlaces secundarios. */
export function PanelSidebar(props: PanelNavProps) {
  const { placeId, active, pendingReviews } = props
  return (
    <aside className="sticky top-[88px] hidden flex-col gap-[18px] lg:flex">
      <BusinessSwitcher {...props} />
      <nav aria-label="Secciones del panel" className="flex flex-col gap-0.5">
        {PANEL_TABS.map(({ key, label, icon: Icon }) => {
          const on = key === active
          return (
            <Link key={key} href={tabHref(placeId, key)} aria-current={on ? 'page' : undefined}
              className={`flex h-[42px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition ${on ? 'bg-tint2 text-ink' : 'text-fg-soft hover:bg-tint hover:text-fg'}`}>
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {key === 'resenas' && pendingReviews > 0 && (
                <span className="rounded-full bg-goospe-green px-[7px] py-0.5 text-[11px] text-on-brand" aria-label={`${pendingReviews} por responder`}>{pendingReviews}</span>
              )}
            </Link>
          )
        })}
      </nav>
      <PanelSecondaryLinks className="flex flex-col gap-0.5 border-t border-line pt-3.5" />
    </aside>
  )
}

/** Tablet y móvil: selector arriba y las mismas secciones como chips. */
export function PanelTopNav(props: PanelNavProps) {
  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <BusinessSwitcher {...props} />
      <PanelChips placeId={props.placeId} active={props.active} pendingReviews={props.pendingReviews} />
    </div>
  )
}
