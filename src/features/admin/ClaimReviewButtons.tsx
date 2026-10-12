'use client'

import { approveClaim, rejectClaim } from '@/actions/admin-claims'
import { DecisionButtons } from '@/features/admin/DecisionButtons'

/** Aprobar / rechazar (con motivo obligatorio) una solicitud de reclamo pendiente. */
export function ClaimReviewButtons({ claimId, placeName }: { claimId: string; placeName: string }) {
  return (
    <DecisionButtons idField="claim_id" id={claimId} approve={approveClaim} reject={rejectClaim} approvedMessage={`«${placeName}» aprobado`} />
  )
}
