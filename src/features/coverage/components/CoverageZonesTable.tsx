'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Search, MapPin } from 'lucide-react'
import { reverseGeocodeZone, type ResolvedZone } from '@/actions/coverage-request'

export type CoverageZone = {
  lat: number
  lng: number
  hits: number
  last_seen: string
  tz: string | null
  locale: string | null
}

const mapsHref = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

type RowState = { status: 'idle' | 'loading' } | { status: 'done'; zone: ResolvedZone } | { status: 'error'; msg: string }

export function CoverageZonesTable({ zones }: { zones: CoverageZone[] }) {
  const [resolved, setResolved] = useState<Record<string, RowState>>({})

  async function identify(z: CoverageZone) {
    const key = `${z.lat},${z.lng}`
    setResolved((r) => ({ ...r, [key]: { status: 'loading' } }))
    const res = await reverseGeocodeZone({ lat: z.lat, lng: z.lng })
    setResolved((r) => ({
      ...r,
      [key]: 'error' in res ? { status: 'error', msg: res.error } : { status: 'done', zone: res.zone },
    }))
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-4 py-3 font-medium">Zona (aprox.)</th>
            <th className="px-4 py-3 font-medium">Región / idioma</th>
            <th className="px-4 py-3 text-right font-medium">Aperturas</th>
            <th className="px-4 py-3 font-medium">Última vez</th>
            <th className="px-4 py-3 font-medium">Qué cargar</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => {
            const key = `${z.lat},${z.lng}`
            const state = resolved[key] ?? { status: 'idle' as const }
            return (
              <tr key={key} className="border-b border-line/60 align-top last:border-0">
                <td className="px-4 py-3 font-medium text-fg">
                  {z.lat.toFixed(1)}, {z.lng.toFixed(1)}
                  <a
                    href={mapsHref(z.lat, z.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center gap-0.5 text-xs text-goospe-green hover:underline"
                  >
                    mapa <ExternalLink size={11} strokeWidth={2} />
                  </a>
                </td>
                <td className="px-4 py-3 text-fg-soft">
                  {z.tz ?? '—'}
                  {z.locale && <span className="text-muted"> · {z.locale}</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-goospe-green">{z.hits}</td>
                <td className="px-4 py-3 text-fg-soft">{fmtDate(z.last_seen)}</td>
                <td className="px-4 py-3">
                  {state.status === 'idle' && (
                    <button
                      onClick={() => identify(z)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg"
                    >
                      <Search size={13} strokeWidth={2} /> Identificar
                    </button>
                  )}
                  {state.status === 'loading' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <Loader2 size={13} className="animate-spin" /> Resolviendo…
                    </span>
                  )}
                  {state.status === 'error' && (
                    <span className="text-xs text-red-600">{state.msg}</span>
                  )}
                  {state.status === 'done' && <ResolvedCell zone={state.zone} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Muestra los tres valores tal como se piden en el cargador (País → Región → Ciudad), resaltando
// el nombre EXACTO de región del catálogo cuando lo encontramos, para copiarlo al <select>.
function ResolvedCell({ zone }: { zone: ResolvedZone }) {
  return (
    <div className="space-y-1 text-xs">
      <Field label="País" value={zone.country} />
      <Field
        label="Región"
        value={zone.catalogRegion ?? zone.regionRaw}
        hint={zone.catalogRegion ? undefined : zone.regionRaw ? '(no está tal cual en el catálogo — elígela a mano)' : undefined}
      />
      <Field label="Ciudad" value={zone.city} icon />
      {!zone.inCatalog && (
        <p className="text-amber-600">El país no está en el catálogo del cargador.</p>
      )}
    </div>
  )
}

function Field({ label, value, hint, icon }: { label: string; value: string | null; hint?: string; icon?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="w-12 shrink-0 text-muted">{label}</span>
      <span className="font-medium text-fg">
        {icon && value && <MapPin size={11} strokeWidth={2} className="mr-0.5 inline text-goospe-green" />}
        {value ?? '—'}
      </span>
      {hint && <span className="text-muted">{hint}</span>}
    </div>
  )
}
