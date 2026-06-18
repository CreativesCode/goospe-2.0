import { ShieldCheck, Heart, Star, Calendar, Store, Download } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminToggle } from '@/features/admin/AdminToggle'

export const dynamic = 'force-dynamic'

const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function tally(rows: { user_id: string | null }[]) {
  const m: Record<string, number> = {}
  for (const r of rows) if (r.user_id) m[r.user_id] = (m[r.user_id] ?? 0) + 1
  return m
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  const [{ data: { users: authUsers } }, { data: profilesData }, fav, rev, rsvp, mem] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, display_name, is_admin, created_at'),
    admin.from('favorites').select('user_id'),
    admin.from('reviews').select('user_id'),
    admin.from('event_rsvps').select('user_id'),
    admin.from('business_members').select('user_id, role'),
  ])

  const profiles = Object.fromEntries(((profilesData ?? []) as { id: string; display_name: string | null; is_admin: boolean | null; created_at: string | null }[]).map((p) => [p.id, p]))
  const favN = tally((fav.data ?? []) as { user_id: string | null }[])
  const revN = tally((rev.data ?? []) as { user_id: string | null }[])
  const rsvpN = tally((rsvp.data ?? []) as { user_id: string | null }[])
  const bizN = tally((mem.data ?? []) as { user_id: string | null }[])

  const rows = (authUsers ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? '—',
      lastSignIn: u.last_sign_in_at,
      createdAt: u.created_at,
      profile: profiles[u.id],
    }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-fg">Usuarios</h1>
          <p className="text-sm text-fg-soft">{rows.length} {rows.length === 1 ? 'usuario registrado' : 'usuarios registrados'} · actividad y rol.</p>
        </div>
        <a href="/admin/users/export" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-fg-soft transition hover:text-fg">
          <Download size={15} /> Exportar CSV
        </a>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-3 py-3 font-medium">Alta</th>
              <th className="px-3 py-3 font-medium">Último acceso</th>
              <th className="px-3 py-3 text-right font-medium"><Heart size={13} className="inline" /></th>
              <th className="px-3 py-3 text-right font-medium"><Star size={13} className="inline" /></th>
              <th className="px-3 py-3 text-right font-medium"><Calendar size={13} className="inline" /></th>
              <th className="px-3 py-3 text-right font-medium"><Store size={13} className="inline" /></th>
              <th className="px-4 py-3 text-right font-medium">Rol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg">{u.profile?.display_name || u.email.split('@')[0]}</span>
                    {u.profile?.is_admin && <span className="inline-flex items-center gap-1 rounded-full bg-goospe-green/10 px-2 py-0.5 text-[10px] font-medium text-goospe-green-dark"><ShieldCheck size={11} /> admin</span>}
                  </div>
                  <span className="text-xs text-muted">{u.email}</span>
                </td>
                <td className="px-3 py-3 text-fg-soft">{fmt(u.createdAt)}</td>
                <td className="px-3 py-3 text-fg-soft">{fmt(u.lastSignIn)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{favN[u.id] ?? 0}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{revN[u.id] ?? 0}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{rsvpN[u.id] ?? 0}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{bizN[u.id] ?? 0}</td>
                <td className="px-4 py-3 text-right"><AdminToggle userId={u.id} isAdmin={!!u.profile?.is_admin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Columnas: <Heart size={11} className="inline" /> guardados · <Star size={11} className="inline" /> reseñas · <Calendar size={11} className="inline" /> RSVPs · <Store size={11} className="inline" /> negocios.</p>
    </div>
  )
}
