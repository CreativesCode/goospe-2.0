import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ListingForm } from '@/features/business/ListingForm'
import { EventManager } from '@/features/business/EventManager'
import { BoostControl } from '@/features/business/BoostControl'
import { StatsPanel } from '@/features/business/StatsPanel'
import { ReviewReplies } from '@/features/business/ReviewReplies'
import { MenuUpload } from '@/features/business/MenuUpload'
import { WeeklyReport } from '@/features/business/WeeklyReport'

const toMetricsMap = (rows: { kind: string; n: number }[] | null) =>
  Object.fromEntries((rows ?? []).map((r) => [r.kind, Number(r.n)]))

export const dynamic = 'force-dynamic'

type PlaceEdit = {
  id: string
  slug: string
  name: string
  business_id: string | null
  description: string | null
  vibe_line: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  price_level: number | null
  tags: string[] | null
  menu: unknown | null
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ placeId: string }>
}) {
  const { placeId } = await params
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/panel/${placeId}`)

  const admin = createAdminClient()
  const { data } = await admin
    .from('places')
    .select('id, slug, name, business_id, description, vibe_line, phone, whatsapp, website, instagram, price_level, tags, menu')
    .eq('id', placeId)
    .single()
  const place = data as unknown as PlaceEdit | null
  if (!place) notFound()

  // Verificar membresía: el usuario debe pertenecer al negocio dueño del place.
  let allowed = false
  if (place.business_id) {
    const { data: member } = await admin
      .from('business_members')
      .select('user_id')
      .eq('business_id', place.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    allowed = !!member
  }
  if (!allowed) redirect('/panel')

  // Maestro-detalle (tablet/web): lista de lugares del dueño para la barra lateral.
  const { data: memberships } = await admin
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
  const businessIds = ((memberships ?? []) as { business_id: string }[]).map((m) => m.business_id)
  let siblings: { id: string; name: string; is_published: boolean }[] = []
  if (businessIds.length) {
    const { data: sib } = await admin
      .from('places')
      .select('id, name, is_published')
      .in('business_id', businessIds)
      .order('name')
    siblings = (sib ?? []) as unknown as { id: string; name: string; is_published: boolean }[]
  }

  // Eventos del lugar + boost activo (para los controles del dueño).
  const { data: evRows } = await admin
    .from('events')
    .select('id, name, starts_at, description, is_boosted')
    .eq('place_id', placeId)
    .order('starts_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (evRows ?? []) as any[]

  const { data: boostRows } = await admin
    .from('boosts')
    .select('id, ends_at, status, starts_at')
    .eq('place_id', placeId)
    .eq('status', 'active')
    .order('ends_at', { ascending: false })
    .limit(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeBoostRow = (boostRows ?? [])[0] as any
  const now = Date.now()
  const activeBoost =
    activeBoostRow && new Date(activeBoostRow.ends_at).getTime() > now
      ? { id: activeBoostRow.id as string, ends_at: activeBoostRow.ends_at as string }
      : null

  // Métricas de comportamiento (7 y 30 días) + agregados de place_stats.
  const [{ data: m30 }, { data: m7 }, { data: stats }] = await Promise.all([
    admin.rpc('place_metrics', { p_place_id: placeId, p_days: 30 } as never),
    admin.rpc('place_metrics', { p_place_id: placeId, p_days: 7 } as never),
    admin.from('place_stats').select('saves_count, rating, reviews_count').eq('place_id', placeId).maybeSingle(),
  ])
  const d30 = toMetricsMap(m30 as { kind: string; n: number }[] | null)
  const d7 = toMetricsMap(m7 as { kind: string; n: number }[] | null)
  const st = (stats ?? {}) as { saves_count?: number; rating?: number; reviews_count?: number }

  const { data: revRows } = await admin
    .from('reviews')
    .select('id, rating, body, created_at')
    .eq('place_id', placeId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews = (revRows ?? []) as any[]

  // Último informe semanal de ESTE lugar (filtrado por place_id dentro del content).
  const { data: reportRows } = await admin
    .from('business_reports')
    .select('content, created_at')
    .eq('business_id', place.business_id as string)
    .eq('kind', 'weekly')
    .order('created_at', { ascending: false })
    .limit(10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestReportRow = ((reportRows ?? []) as any[]).find((r) => r.content?.place_id === placeId)
  const latestReport = latestReportRow
    ? { summary: latestReportRow.content.summary as string, created_at: latestReportRow.created_at as string }
    : null

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto flex max-w-6xl gap-8 px-5 py-8">
        {/* maestro: lista de lugares (solo tablet/web) */}
        {siblings.length > 1 && (
          <aside className="hidden w-64 shrink-0 lg:block">
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">Mis lugares</h2>
            <nav className="flex flex-col gap-2">
              {siblings.map((s) => {
                const current = s.id === place.id
                return (
                  <Link
                    key={s.id}
                    href={`/panel/${s.id}`}
                    className={`rounded-2xl border bg-card px-4 py-3 transition ${current ? 'border-goospe-green ring-1 ring-goospe-green' : 'border-line hover:border-goospe-green/40'}`}
                  >
                    <div className="truncate text-sm font-medium text-fg">{s.name}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${s.is_published ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-line text-muted'}`}>
                      {s.is_published ? 'Publicado' : 'Oculto'}
                    </span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        )}

        {/* detalle */}
        <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-fg">{place.name}</h1>
            <p className="text-sm text-muted">Edita cómo se ve tu ficha en Goospe</p>
          </div>
          <Link
            href={`/places/${place.slug}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-goospe-green/40 px-4 py-2 text-sm font-medium text-goospe-green-dark hover:bg-goospe-green/10"
          >
            Ver ficha pública <ArrowRight size={14} strokeWidth={1.75} />
          </Link>
        </div>

        <div className="space-y-6">
          <StatsPanel
            d7={d7}
            d30={d30}
            savesTotal={st.saves_count ?? 0}
            rating={st.rating ?? 0}
            reviewsCount={st.reviews_count ?? 0}
          />

          <WeeklyReport placeId={place.id} latest={latestReport} />

          <BoostControl placeId={place.id} active={activeBoost} />

          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <ListingForm place={place} />
          </div>

          <MenuUpload placeId={place.id} hasMenu={!!place.menu} />

          <EventManager placeId={place.id} events={events} />

          <ReviewReplies placeId={place.id} reviews={reviews} />
        </div>
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
