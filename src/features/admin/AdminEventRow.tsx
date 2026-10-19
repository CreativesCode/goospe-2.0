import Link from 'next/link'
import { CalendarClock, ChevronDown, ExternalLink, MapPin, Megaphone } from 'lucide-react'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'
import { PhotoImg } from '@/shared/components/photo-img'
import { eventPath, placePath } from '@/features/places/seo-routes'
import { ModStatusButtons } from '@/features/admin/ModStatusButtons'

export type AdminEvent = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  status: string
  starts_at: string
  ends_at: string | null
  created_at: string
  is_boosted: boolean | null
  places: { name: string; slug: string; cities: { name: string; timezone: string | null } | null } | null
}

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Visible', tone: 'bg-tint text-ink' },
  cancelled: { label: 'Cancelado', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  rejected: { label: 'Oculto', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

const when = (s: string, tz: string | null | undefined) =>
  fmtInZone(s, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Evento en "Moderar contenido": fila compacta que se despliega (sin JS, `<details>`) con
 * imagen, descripción, horario, lugar y enlaces, para decidir si ocultarlo.
 */
export function AdminEventRow({ ev }: { ev: AdminEvent }) {
  const tz = ev.places?.cities?.timezone
  const st = STATUS[ev.status] ?? { label: ev.status, tone: 'bg-tint text-fg-soft' }
  // La página pública solo existe para eventos visibles o cancelados (oculto → 404).
  const isPublic = ev.status === 'approved' || ev.status === 'cancelled'

  return (
    <li className="flex items-start gap-3 rounded-[22px] border border-line bg-card p-3 sm:p-4">
      <details className="group min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <PhotoImg src={ev.image_url} alt="" tone="tint" className="h-12 w-12 shrink-0 rounded-xl object-cover" isoClassName="h-5 w-5" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-fg">{ev.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.tone}`}>{st.label}</span>
              {ev.is_boosted && <span className="rounded-full bg-goospe-green px-2 py-0.5 text-[10px] font-medium text-on-brand">Destacado</span>}
            </span>
            <span className="block truncate text-xs text-muted">{ev.places?.name} · {when(ev.starts_at, tz)}</span>
          </span>
          <ChevronDown size={18} strokeWidth={1.75} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
          <span className="sr-only">Ver detalles</span>
        </summary>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <PhotoImg src={ev.image_url} alt={ev.name} tone="tint" className="aspect-[16/10] w-full rounded-[14px] object-cover" isoClassName="h-8 w-8" />
          <div className="min-w-0 space-y-3 text-sm">
            {ev.description
              ? <p className="whitespace-pre-line text-fg [overflow-wrap:anywhere]">{ev.description}</p>
              : <p className="text-muted">Sin descripción.</p>}
            <dl className="space-y-1.5 text-fg-soft">
              <div className="flex items-start gap-2">
                <dt className="mt-0.5 text-ink"><CalendarClock size={15} strokeWidth={1.75} /><span className="sr-only">Cuándo</span></dt>
                <dd>
                  {when(ev.starts_at, tz)}{ev.ends_at && ` – ${when(ev.ends_at, tz)}`}
                  {ev.places?.cities && <span className="text-muted"> · hora de {ev.places.cities.name}</span>}
                </dd>
              </div>
              {ev.places && (
                <div className="flex items-start gap-2">
                  <dt className="mt-0.5 text-ink"><MapPin size={15} strokeWidth={1.75} /><span className="sr-only">Lugar</span></dt>
                  <dd><Link href={placePath(ev.places.slug)} className="font-medium text-fg hover:text-ink">{ev.places.name}</Link></dd>
                </div>
              )}
              <div className="flex items-start gap-2">
                <dt className="mt-0.5 text-ink"><Megaphone size={15} strokeWidth={1.75} /><span className="sr-only">Publicado</span></dt>
                <dd>Publicado el {fmtInZone(ev.created_at, ADMIN_TZ, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
              </div>
            </dl>
            {isPublic
              ? (
                <a href={eventPath(ev.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline">
                  Ver página del evento <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )
              : <p className="text-xs text-muted">Oculto: su página pública no existe mientras siga así.</p>}
          </div>
        </div>
      </details>
      <ModStatusButtons type="event" id={ev.id} status={ev.status} />
    </li>
  )
}
