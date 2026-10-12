import 'server-only'
import type { EmailContent } from '@/emails/layout'
import { claimApprovedEmail, claimNewTeamEmail, claimReceivedEmail, claimRejectedEmail, changeRequestResolvedEmail } from '@/emails/claims'
import { eventCancelledEmail, eventUpdatedEmail } from '@/emails/alerts'
import { createAdminClient } from '@/lib/supabase/admin'
import { absoluteUrl } from '@/lib/email/config'
import { sendLater } from '@/lib/email/dispatch'
import { adminRecipients, recipientsOf, type Recipient } from '@/lib/email/recipients'
import { sendCriticalReviewAlerts } from '@/lib/email/alerts'
import { sendEmail } from '@/lib/email/send'
import type { EmailCategory } from '@/lib/email/categories'

// Ganchos de email para las server actions: una llamada por aviso, al lado de la notificación
// in-app que ya existía. Todas son `void`: encolan el envío para DESPUÉS de responder
// (sendLater) y nunca lanzan, así que un email que falla jamás hace fallar la acción.
// La clave de cada envío incluye el objeto y el destinatario: repetir la acción no reenvía.

type Mail = {
  template: string
  category: EmailCategory
  key: (userId: string) => string
  render: (links: { unsubscribeUrl: string | null }) => EmailContent
  meta?: Record<string, string>
}

async function sendTo(recipients: Recipient[], mail: Mail): Promise<void> {
  for (const r of recipients) {
    await sendEmail({
      to: r.email, userId: r.userId, template: mail.template, category: mail.category,
      dedupeKey: mail.key(r.userId), render: mail.render, meta: mail.meta,
    })
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** Reclamo enviado: acuse al solicitante y aviso al equipo. */
export function queueClaimSubmittedEmails(p: {
  userId: string; userEmail: string | null; placeId: string; placeName: string
  contactName: string | null; contactPhone: string | null; message: string | null
}): void {
  sendLater('claim_submitted', async () => {
    const admin = createAdminClient()
    // Sin id del reclamo a mano: lugar + usuario + día (solo puede haber uno pendiente a la vez).
    const stamp = `${p.placeId}:${p.userId}:${today()}`
    const claimant = p.userEmail ? [{ userId: p.userId, email: p.userEmail }] : await recipientsOf([p.userId], admin)
    await sendTo(claimant, {
      template: 'claim_received', category: 'transactional', meta: { place_id: p.placeId },
      key: () => `claim_received:${stamp}`,
      render: () => claimReceivedEmail({ placeName: p.placeName, requestsUrl: absoluteUrl('/panel#solicitudes') }),
    })
    await sendTo(await adminRecipients(admin), {
      template: 'claim_new_team', category: 'transactional', meta: { place_id: p.placeId },
      key: (adminId) => `claim_new:${stamp}:${adminId}`,
      render: () => claimNewTeamEmail({
        placeName: p.placeName, contactName: p.contactName, contactEmail: p.userEmail,
        contactPhone: p.contactPhone, message: p.message, adminUrl: absoluteUrl('/admin/claims'),
      }),
    })
  })
}

export function queueClaimApprovedEmail(p: { claimId: string; userId: string; placeId: string; placeName: string }): void {
  sendLater('claim_approved', async () => {
    await sendTo(await recipientsOf([p.userId]), {
      template: 'claim_approved', category: 'transactional', meta: { place_id: p.placeId, claim_id: p.claimId },
      key: () => `claim_approved:${p.claimId}`,
      render: () => claimApprovedEmail({ placeName: p.placeName, panelUrl: absoluteUrl(`/panel/${p.placeId}`) }),
    })
  })
}

export function queueClaimRejectedEmail(p: { claimId: string; userId: string; placeName: string; reason: string }): void {
  sendLater('claim_rejected', async () => {
    await sendTo(await recipientsOf([p.userId]), {
      template: 'claim_rejected', category: 'transactional', meta: { claim_id: p.claimId },
      key: () => `claim_rejected:${p.claimId}`,
      render: () => claimRejectedEmail({ placeName: p.placeName, reason: p.reason, requestsUrl: absoluteUrl('/panel#solicitudes') }),
    })
  })
}

/** Solicitud de cambio (nombre / ubicación) aprobada o rechazada. El nombre del lugar se lee aquí. */
export function queueChangeRequestResolvedEmail(p: {
  requestId: string; userId: string; placeId: string; kind: string
  approved: boolean; newName?: string | null; reason?: string | null
}): void {
  sendLater('change_request_resolved', async () => {
    const admin = createAdminClient()
    const { data } = await admin.from('places').select('name').eq('id', p.placeId).maybeSingle()
    const placeName = (data as { name: string } | null)?.name ?? null
    const url = absoluteUrl(p.approved ? `/panel/${p.placeId}` : '/panel#solicitudes')
    await sendTo(await recipientsOf([p.userId], admin), {
      template: 'change_request_resolved', category: 'transactional', meta: { place_id: p.placeId, request_id: p.requestId },
      key: () => `change_request_resolved:${p.requestId}`,
      render: () => changeRequestResolvedEmail({
        placeName, kind: p.kind === 'name' ? 'name' : 'location', approved: p.approved,
        newName: p.newName ?? null, reason: p.reason ?? null, url,
      }),
    })
  })
}

/** Reseña crítica: drena los avisos `review_critical` de ese lugar (ver lib/email/alerts.ts). */
export function queueCriticalReviewAlerts(placeId: string): void {
  sendLater('review_critical', () => sendCriticalReviewAlerts({ placeId }))
}

type EventMail = { eventId: string; userIds: string[]; eventName: string; placeName: string; placeSlug: string; when: string }

export function queueEventCancelledEmails(p: EventMail & { reason: string | null }): void {
  if (!p.userIds.length) return
  sendLater('event_cancelled', async () => {
    const placeUrl = absoluteUrl(`/places/${p.placeSlug}`)
    await sendTo(await recipientsOf(p.userIds), {
      template: 'event_cancelled', category: 'events', meta: { event_id: p.eventId },
      key: (userId) => `event_cancelled:${p.eventId}:${userId}`,
      render: ({ unsubscribeUrl }) => eventCancelledEmail({
        eventName: p.eventName, placeName: p.placeName, when: p.when, reason: p.reason, placeUrl, unsubscribeUrl,
      }),
    })
  })
}

/** `startsAt` entra en la clave: un segundo cambio de fecha vuelve a avisar; el mismo, no. */
export function queueEventUpdatedEmails(p: EventMail & { startsAt: string }): void {
  if (!p.userIds.length) return
  sendLater('event_updated', async () => {
    const placeUrl = absoluteUrl(`/places/${p.placeSlug}`)
    await sendTo(await recipientsOf(p.userIds), {
      template: 'event_updated', category: 'events', meta: { event_id: p.eventId },
      key: (userId) => `event_updated:${p.eventId}:${p.startsAt}:${userId}`,
      render: ({ unsubscribeUrl }) => eventUpdatedEmail({
        eventName: p.eventName, placeName: p.placeName, when: p.when, placeUrl, unsubscribeUrl,
      }),
    })
  })
}
