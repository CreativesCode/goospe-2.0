import type { Metadata } from 'next'
import Link from 'next/link'
import { Flag, Inbox, MessageSquare, Store } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import { FeedbackOpenItem } from '@/features/admin/FeedbackButtons'
import { STATUS_LABELS, categoryLabel, type FeedbackStatus } from '@/features/feedback/feedback-schema'
import { ADMIN_TZ, fmtInZone } from '@/lib/tz'

export const metadata: Metadata = { title: 'Feedback' }

export const dynamic = 'force-dynamic'

type Row = {
  id: string; kind: string; category: string; message: string | null; place_id: string | null
  user_id: string | null; contact_email: string | null; client_key: string | null; page: string | null
  status: string; admin_note: string | null; created_at: string; resolved_at: string | null
  places: { name: string; slug: string; business_id: string | null } | null
}

const COLS = 'id, kind, category, message, place_id, user_id, contact_email, client_key, page, status, admin_note, created_at, resolved_at, places(name, slug, business_id)'
const OPEN_LIMIT = 100
const fmt = (s: string | null) =>
  s ? fmtInZone(s, ADMIN_TZ, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// Bandeja de feedback general y de "sugerir corrección". Resolver no cambia el lugar: la
// corrección se aplica desde la ficha del admin (enlace en cada fila).
export default async function AdminFeedbackPage() {
  await requireAdmin('/admin/feedback') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()

  const [openRes, recentRes] = await Promise.all([
    admin.from('feedback').select(COLS, { count: 'exact' }).eq('status', 'open').order('created_at', { ascending: true }).limit(OPEN_LIMIT),
    admin.from('feedback').select(COLS).neq('status', 'open').order('resolved_at', { ascending: false }).limit(20),
  ])
  const open = (openRes.data ?? []) as unknown as Row[]
  const recent = (recentRes.data ?? []) as unknown as Row[]
  const failed = openRes.error ?? recentRes.error

  // Quién lo envió (si tenía sesión): nombre del perfil y email para poder responderle.
  const userIds = [...new Set(open.map((r) => r.user_id).filter((id): id is string => !!id))]
  const { data: profs } = userIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const nameByUser = new Map(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]))
  const emailByUser = new Map<string, string>()
  await Promise.all(userIds.slice(0, 50).map(async (id) => {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emailByUser.set(id, data.user.email)
  }))

  const sender = (r: Row) => {
    if (r.user_id) return [nameByUser.get(r.user_id) || 'Usuario', emailByUser.get(r.user_id)].filter(Boolean).join(' · ')
    return r.contact_email ? `Anónimo · ${r.contact_email}` : `Anónimo${r.client_key ? ` (${r.client_key.slice(0, 6)})` : ''}`
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-fg">Feedback y correcciones</h1>
        <p className="text-sm text-fg-soft">Mensajes de usuarios y sugerencias de corrección de las fichas. Marcar como resuelto no cambia el lugar: corrige el dato en su ficha y luego ciérralo aquí.</p>
      </header>

      {failed && (
        <p role="alert" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No pudimos leer la bandeja. Si la migración 0042 aún no está aplicada, esta sección no funciona.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Inbox size={15} strokeWidth={1.75} /> Abiertos
          {(openRes.count ?? 0) > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">{openRes.count}</span>}
        </h2>
        {open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm text-fg-soft">No hay mensajes por revisar.</div>
        ) : (
          <ul className="space-y-3">
            {open.map((r) => (
              <FeedbackOpenItem key={r.id} feedbackId={r.id}>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 font-medium text-fg-soft">
                        {r.kind === 'correction' ? <><Flag size={12} /> Corrección</> : <><MessageSquare size={12} /> Feedback</>}
                      </span>
                      <span className="[overflow-wrap:anywhere]">{sender(r)} · {fmt(r.created_at)}</span>
                    </p>
                    <p className="font-medium text-fg">{categoryLabel(r.kind, r.category)}</p>
                    {r.places && r.place_id && (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <Link href={`/admin/places/${r.place_id}`} className="font-medium text-ink hover:underline">{r.places.name}</Link>
                        <Link href={`/places/${r.places.slug}`} target="_blank" className="text-fg-soft hover:underline">Ver ficha pública</Link>
                        {r.places.business_id && <span className="inline-flex items-center gap-1 text-xs text-muted"><Store size={12} /> Tiene dueño (ya fue avisado)</span>}
                      </p>
                    )}
                    {r.message && <p className="whitespace-pre-line rounded-lg bg-card px-3 py-2 text-sm text-fg-soft [overflow-wrap:anywhere]">{r.message}</p>}
                    {r.page && <p className="text-xs text-muted [overflow-wrap:anywhere]">Enviado desde {r.page}</p>}
              </FeedbackOpenItem>
            ))}
          </ul>
        )}
        {(openRes.count ?? 0) > open.length && <p className="text-xs text-muted">Se muestran los {open.length} más antiguos de {openRes.count}.</p>}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Cerrados recientemente</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 text-fg [overflow-wrap:anywhere]">
                  {categoryLabel(r.kind, r.category)}{r.places ? <span className="text-muted"> · {r.places.name}</span> : null}
                  {r.message && <span className="line-clamp-1 block text-xs text-fg-soft">{r.message}</span>}
                  {r.admin_note && <span className="block text-xs text-fg-soft">Nota: {r.admin_note}</span>}
                </span>
                <span className="shrink-0 text-xs text-fg-soft">{STATUS_LABELS[r.status as FeedbackStatus] ?? r.status} · {fmt(r.resolved_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
