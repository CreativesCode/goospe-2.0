import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClaimRequestForm } from '@/features/business/ClaimRequestForm'
import { PhotoImg } from '@/shared/components/photo-img'

export const dynamic = 'force-dynamic'

type Category = { name: string; emoji: string | null }
type Claimable = {
  id: string
  name: string
  vibe_line: string | null
  address: { formatted?: string; city?: string } | null
  place_photos: { url: string; status: string }[] | null
  place_categories: { categories: Category | null }[] | null
}

export default async function ReclamarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; sent?: string }>
}) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel/claim')

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const error = sp.error
  const sent = sp.sent === '1'
  let results: Claimable[] = []
  if (q.length >= 2) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('places')
      .select('id, name, vibe_line, address, place_photos(url, status), place_categories(categories(name, emoji))')
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
        <p className="mt-1 text-fg-soft">Busca tu lugar y solicita administrarlo. Revisamos cada solicitud personalmente.</p>

        {sent && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-goospe-green/30 bg-goospe-green/5 p-4">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-goospe-green" />
            <div>
              <p className="font-medium text-fg">¡Solicitud enviada!</p>
              <p className="text-sm text-fg-soft">Nuestro equipo revisará tu reclamo y te contactará para confirmar que el negocio es tuyo. Te avisaremos cuando esté aprobado.</p>
            </div>
          </div>
        )}

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
          {results.map((p) => {
            const photo = (p.place_photos ?? []).find((ph) => ph.status === 'approved')?.url
              ?? (p.place_photos ?? [])[0]?.url
            const cats = (p.place_categories ?? []).map((pc) => pc.categories).filter(Boolean) as Category[]
            const city = p.address?.city
            return (
              <div key={p.id} className="rounded-xl border border-line bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <PhotoImg src={photo} alt={p.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" isoClassName="h-7 w-7" />
                    <div className="min-w-0">
                      <h2 className="font-medium text-fg">{p.name}</h2>
                      {cats.length > 0 && (
                        <p className="text-xs text-muted">
                          {cats.map((c) => `${c.emoji ? c.emoji + ' ' : ''}${c.name}`).join(' · ')}
                          {city ? ` · ${city}` : ''}
                        </p>
                      )}
                      {p.vibe_line && <p className="truncate text-sm text-goospe-green">{p.vibe_line}</p>}
                      {p.address?.formatted && <p className="truncate text-xs text-muted">{p.address.formatted}</p>}
                    </div>
                  </div>
                </div>
                <ClaimRequestForm placeId={p.id} placeName={p.name} />
              </div>
            )
          })}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
