import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

/** Texto -> slug de URL: minúsculas, sin tildes, guiones, máx. 60 caracteres. */
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 60)

/** Garantiza un slug único (sufijo -2, -3… si choca). Excluye el propio place al editar. */
export async function uniqueSlug(admin: AdminClient, base: string, selfId: string | null): Promise<string> {
  const root = base || 'lugar'
  let slug = root
  for (let i = 0; i < 50; i++) {
    const { data } = await admin.from('places').select('id').eq('slug', slug).maybeSingle()
    const hit = data as { id: string } | null
    if (!hit || hit.id === selfId) return slug
    slug = `${root}-${i + 2}`
  }
  return `${root}-${Date.now()}`
}
