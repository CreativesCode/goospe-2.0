import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/ownership'
import { toCsv, csvResponse } from '@/lib/csv'

export const dynamic = 'force-dynamic'

function tally(rows: { user_id: string | null }[]) {
  const m: Record<string, number> = {}
  for (const r of rows) if (r.user_id) m[r.user_id] = (m[r.user_id] ?? 0) + 1
  return m
}

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !(await isAdmin(user.id))) return new Response('Forbidden', { status: 403 })

  const admin = createAdminClient()
  const [{ data: { users: authUsers } }, { data: profilesData }, fav, rev, rsvp, mem] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, display_name, is_admin, created_at'),
    admin.from('favorites').select('user_id'),
    admin.from('reviews').select('user_id'),
    admin.from('event_rsvps').select('user_id'),
    admin.from('business_members').select('user_id'),
  ])

  const profiles = Object.fromEntries(((profilesData ?? []) as { id: string; display_name: string | null; is_admin: boolean | null }[]).map((p) => [p.id, p]))
  const favN = tally((fav.data ?? []) as { user_id: string | null }[])
  const revN = tally((rev.data ?? []) as { user_id: string | null }[])
  const rsvpN = tally((rsvp.data ?? []) as { user_id: string | null }[])
  const bizN = tally((mem.data ?? []) as { user_id: string | null }[])

  const csv = toCsv(
    ['email', 'nombre', 'es_admin', 'alta', 'ultimo_acceso', 'guardados', 'resenas', 'rsvps', 'negocios'],
    (authUsers ?? []).map((u) => [
      u.email ?? '',
      profiles[u.id]?.display_name ?? '',
      profiles[u.id]?.is_admin ? 'si' : 'no',
      u.created_at ?? '',
      u.last_sign_in_at ?? '',
      favN[u.id] ?? 0,
      revN[u.id] ?? 0,
      rsvpN[u.id] ?? 0,
      bizN[u.id] ?? 0,
    ]),
  )
  return csvResponse('goospe-usuarios.csv', csv)
}
