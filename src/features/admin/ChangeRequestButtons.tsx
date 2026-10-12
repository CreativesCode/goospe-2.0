'use client'

import { approveChangeRequest, rejectChangeRequest } from '@/actions/admin-requests'
import { DecisionButtons } from '@/features/admin/DecisionButtons'

const coord = 'w-28 rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-fg outline-none focus:border-goospe-green'

/**
 * Aprobar / rechazar una solicitud de cambio. En las de ubicación el admin confirma las
 * coordenadas del pin (vienen precargadas si el dueño pegó un enlace de mapa o "lat, lng").
 */
export function ChangeRequestButtons({ requestId, kind, lat, lng }: {
  requestId: string; kind: string; lat: number | null; lng: number | null
}) {
  return (
    <DecisionButtons idField="request_id" id={requestId} approve={approveChangeRequest} reject={rejectChangeRequest}
      approvedMessage={kind === 'name' ? 'Nombre actualizado' : 'Pin actualizado'}>
      {kind === 'location' && (
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-fg-soft">Latitud
            <input name="lat" required inputMode="decimal" defaultValue={lat ?? ''} placeholder="-41.3195" className={`mt-0.5 block ${coord}`} />
          </label>
          <label className="text-xs text-fg-soft">Longitud
            <input name="lng" required inputMode="decimal" defaultValue={lng ?? ''} placeholder="-72.9854" className={`mt-0.5 block ${coord}`} />
          </label>
        </div>
      )}
    </DecisionButtons>
  )
}
