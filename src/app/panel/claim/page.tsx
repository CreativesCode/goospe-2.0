import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Search } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClaimRequestForm } from '@/features/business/ClaimRequestForm'
import { ClaimSteps } from '@/features/business/ClaimSteps'
import { PhotoImg } from '@/shared/components/photo-img'
import { PageHeader } from '@/shared/components/page-header'
import { pageShell } from '@/shared/lib/ui'

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

function ClaimResult({ place }: { place: Claimable }) {
  const photos = place.place_photos ?? []
  const photo = photos.find((ph) => ph.status === 'approved')?.url ?? photos[0]?.url
  const cats = (place.place_categories ?? []).map((pc) => pc.categories).filter(Boolean) as Category[]
  const meta = [...cats.map((c) => `${c.emoji ? c.emoji + ' ' : ''}${c.name}`), place.address?.city].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-line bg-card p-4 sm:p-5">
      <div className="flex min-w-0 flex-1 basis-64 gap-4">
        <PhotoImg src={photo} alt={place.name} tone="tint" className="h-[72px] w-[72px] shrink-0 rounded-[14px] object-cover" isoClassName="h-7 w-7" />
        <div className="min-w-0">
          <h2 className="text-lg font-medium leading-tight text-fg">{place.name}</h2>
          {meta && <p className="mt-0.5 text-xs text-muted">{meta}</p>}
          {place.vibe_line && <p className="mt-1 truncate text-sm font-medium text-ink">{place.vibe_line}</p>}
          {place.address?.formatted && <p className="truncate text-xs text-muted">{place.address.formatted}</p>}
        </div>
      </div>
      <ClaimRequestForm placeId={place.id} placeName={place.name} />
    </div>
  )
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

      <div className={pageShell}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          <div className="min-w-0">
            <PageHeader back={{ href: '/panel', label: 'Mis lugares' }} kicker="Para tu negocio" title={<>Reclama tu <span className="font-medium">negocio</span></>} subtitle="Busca tu lugar y solicita administrarlo. Revisamos cada solicitud personalmente." />

            {sent && (
              <div className="mt-6 flex items-start gap-3 rounded-[22px] border border-goospe-green/30 bg-tint p-4 sm:p-5">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-ink" />
                <div>
                  <p className="font-medium text-fg">¡Solicitud enviada!</p>
                  <p className="text-sm text-fg-soft">Nuestro equipo revisará tu reclamo y te contactará para confirmar que el negocio es tuyo. Te avisaremos cuando esté aprobado.</p>
                </div>
              </div>
            )}

            {error && <p className="mt-6 rounded-[14px] bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <form method="GET" className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Nombre de tu negocio</span>
                <Search size={19} strokeWidth={1.75} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Nombre de tu negocio…"
                  className="h-[54px] w-full rounded-full border border-line bg-card pl-[52px] pr-5 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:shadow-[0_0_0_4px_rgba(45,193,134,0.12)]"
                />
              </label>
              <button className="h-[54px] rounded-full bg-goospe-green px-7 font-medium text-on-brand transition hover:brightness-105">Buscar</button>
            </form>

            <div className="mt-6 space-y-3">
              {q.length >= 2 && (
                <p className="text-sm text-muted">
                  {results.length === 0 ? 'Sin resultados' : `${results.length} ${results.length === 1 ? 'lugar' : 'lugares'} sin reclamar`} para “{q}”
                </p>
              )}
              {q.length >= 2 && results.length === 0 && (
                <p className="rounded-[22px] border border-line bg-card p-5 text-sm text-fg-soft">
                  No encontramos lugares sin reclamar con “{q}”. Puede que ya esté reclamado o aún no esté en Goospe.
                </p>
              )}
              {results.map((p) => <ClaimResult key={p.id} place={p} />)}
              {q.length >= 2 && (
                <p className="rounded-[22px] border border-dashed border-line p-5 text-sm text-fg-soft">
                  ¿Tu negocio no aparece en la lista?{' '}
                  <Link href={`/panel/propose?name=${encodeURIComponent(q)}`} className="font-medium text-ink hover:underline">Proponlo como lugar nuevo</Link>
                  {' '}y lo sumamos a Goospe.
                </p>
              )}
            </div>
          </div>

          <ClaimSteps />
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
