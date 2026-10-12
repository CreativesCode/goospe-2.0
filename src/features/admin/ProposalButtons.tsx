'use client'

import { approvePlaceProposal, rejectPlaceProposal } from '@/actions/admin-proposals'
import { DecisionButtons } from '@/features/admin/DecisionButtons'

const field = 'rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-fg outline-none focus:border-goospe-green'

/**
 * Aprobar / rechazar un lugar propuesto. El admin confirma el pin (precargado si el solicitante
 * pegó un enlace de mapa o "lat, lng") y la ciudad. La casilla solo es obligatoria si el servidor
 * encuentra un duplicado casi seguro con el pin definitivo (o no puede comprobarlo); va siempre
 * visible porque el admin puede cambiar las coordenadas antes de aprobar.
 */
export function ProposalButtons({ proposalId, lat, lng, cityId, cities }: {
  proposalId: string; lat: number | null; lng: number | null; cityId: number | null
  cities: { id: number; name: string }[]
}) {
  return (
    <DecisionButtons idField="proposal_id" id={proposalId} approve={approvePlaceProposal} reject={rejectPlaceProposal}
      approvedMessage="Lugar creado y publicado">
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-fg-soft">Latitud
          <input name="lat" required inputMode="decimal" defaultValue={lat ?? ''} placeholder="-41.3195" className={`mt-0.5 block w-28 ${field}`} />
        </label>
        <label className="text-xs text-fg-soft">Longitud
          <input name="lng" required inputMode="decimal" defaultValue={lng ?? ''} placeholder="-72.9854" className={`mt-0.5 block w-28 ${field}`} />
        </label>
      </div>
      <label className="text-xs text-fg-soft">Ciudad
        <select name="city_id" defaultValue={cityId ?? ''} className={`select-chevron mt-0.5 block w-full sm:w-60 ${field}`}>
          <option value="">Automática (la más cercana al pin)</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex max-w-60 items-start gap-2 text-xs text-fg-soft">
        <input type="checkbox" name="confirm_duplicate" className="mt-0.5 h-4 w-4 accent-goospe-green" />
        No es un duplicado: revisé los lugares parecidos
      </label>
    </DecisionButtons>
  )
}
