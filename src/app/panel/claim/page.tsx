import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimPlace } from '@/actions/business'

export const dynamic = 'force-dynamic'

type Claimable = {
  id: string
  name: string
  vibe_line: string | null
  address: { formatted?: string; city?: string } | null
}

export default async function ReclamarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>
}) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel/claim')

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const error = sp.error
  let results: Claimable[] = []
  if (q.length >= 2) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('places')
      .select('id, name, vibe_line, address')
      .eq('claimed', false)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(20)
    results = (data ?? []) as unknown as Claimable[]
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/panel" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-soft transition hover:text-goospe-green">
          <ArrowLeft size={16} strokeWidth={1.75} /> Mis lugares
        </Link>
        <h1 className="text-2xl font-medium text-fg">Reclama tu negocio</h1>
        <p className="mt-1 text-fg-soft">Busca tu lugar y reclámalo para administrarlo.</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>
        )}

        <form method="GET" className="mt-6 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Nombre de tu negocio…"
            className="flex-1 rounded-full border border-line bg-card px-5 py-3 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30"
          />
          <button className="rounded-full bg-goospe-gradient px-6 py-3 font-medium text-white shadow">Buscar</button>
        </form>

        <div className="mt-6 space-y-3">
          {q.length >= 2 && results.length === 0 && (
            <p className="rounded-xl bg-card p-4 text-sm text-fg-soft">
              No encontramos lugares sin reclamar con “{q}”. Puede que ya esté reclamado o aún no esté en Goospe.
            </p>
          )}
          {results.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card p-4 shadow-sm">
              <div className="min-w-0">
                <h2 className="font-medium text-fg">{p.name}</h2>
                {p.vibe_line && <p className="truncate text-sm text-goospe-green">{p.vibe_line}</p>}
                {p.address?.formatted && <p className="truncate text-xs text-muted">{p.address.formatted}</p>}
              </div>
              <form action={claimPlace}>
                <input type="hidden" name="place_id" value={p.id} />
                <button className="shrink-0 rounded-full bg-goospe-green px-4 py-2 text-sm font-medium text-white transition hover:bg-goospe-green-dark">
                  Reclamar
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
