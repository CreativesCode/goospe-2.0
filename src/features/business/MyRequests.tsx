'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, XCircle } from 'lucide-react'
import { cancelChangeRequest, cancelClaim } from '@/actions/owner-requests'
import { cancelPlaceProposal } from '@/actions/place-proposals'
import { toast } from '@/shared/components/toast'
import { cardClass, sectionTitle } from '@/features/business/ui'

export type MyClaim = { id: string; placeName: string; status: string; rejectReason: string | null; createdAt: string }
export type MyChangeRequest = {
  id: string; placeId: string; placeName: string; kind: string; status: string
  detail: string; rejectReason: string | null; createdAt: string
}

export type MyProposal = { id: string; name: string; detail: string; status: string; rejectReason: string | null; createdAt: string }

type Item = {
  key: string; title: string; detail: string | null; status: string; rejectReason: string | null
  createdAt: string; cancel: () => Promise<{ error?: string } | undefined>
}

const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }) : '')

function Row({ item }: { item: Item }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const pending = item.status === 'pending'

  async function onCancel() {
    if (!window.confirm('¿Cancelar esta solicitud?')) return
    setBusy(true)
    const res = await item.cancel()
    setBusy(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success('Solicitud cancelada')
    router.refresh()
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg [overflow-wrap:anywhere]">{item.title}</p>
          {item.detail && <p className="text-xs text-fg-soft [overflow-wrap:anywhere]">{item.detail}</p>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${pending ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
          {pending ? <><Clock size={12} strokeWidth={2} /> En revisión</> : <><XCircle size={12} strokeWidth={2} /> Rechazada</>}
        </span>
      </div>
      {!pending && item.rejectReason && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-fg-soft"><span className="font-medium text-fg">Motivo:</span> {item.rejectReason}</p>
      )}
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Enviada el {fmtDate(item.createdAt)}</span>
        {pending && (
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 text-sm text-red-600 hover:underline disabled:opacity-60 dark:text-red-400">
            {busy ? 'Cancelando…' : 'Cancelar solicitud'}
          </button>
        )}
      </div>
    </li>
  )
}

const form = (key: string, id: string) => { const fd = new FormData(); fd.set(key, id); return fd }

/** "Mis solicitudes": reclamos, cambios pedidos y lugares propuestos, con su estado, el motivo si se rechazaron y cancelar. */
export function MyRequests({ claims, changes, proposals = [] }: { claims: MyClaim[]; changes: MyChangeRequest[]; proposals?: MyProposal[] }) {
  const items: Item[] = [
    ...claims.map((c) => ({
      key: `claim-${c.id}`, title: `Reclamo de ${c.placeName}`, detail: null, status: c.status,
      rejectReason: c.rejectReason, createdAt: c.createdAt, cancel: () => cancelClaim(form('claim_id', c.id)),
    })),
    ...changes.map((r) => ({
      key: `change-${r.id}`, title: `Cambio de ${r.kind === 'name' ? 'nombre' : 'ubicación'} · ${r.placeName}`,
      detail: r.detail || null, status: r.status, rejectReason: r.rejectReason, createdAt: r.createdAt,
      cancel: () => cancelChangeRequest(form('request_id', r.id)),
    })),
    ...proposals.map((p) => ({
      key: `proposal-${p.id}`, title: `Lugar nuevo · ${p.name}`, detail: p.detail || null, status: p.status,
      rejectReason: p.rejectReason, createdAt: p.createdAt, cancel: () => cancelPlaceProposal(form('proposal_id', p.id)),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  if (!items.length) return null
  return (
    <section id="solicitudes" className={`scroll-mt-32 ${cardClass}`}>
      <h2 className={`mb-3 ${sectionTitle}`}>Mis solicitudes</h2>
      <ul className="space-y-3">{items.map((item) => <Row key={item.key} item={item} />)}</ul>
    </section>
  )
}
