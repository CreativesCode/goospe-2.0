import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { appContainer } from '@/shared/lib/ui'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import type { PlaceVisibility } from '@/features/business/PlaceSettings'
import { PanelSecondaryLinks, PanelSidebar, PanelTopNav, type PanelNavProps } from '@/features/business/PanelNav'
import { countPendingReviews, loadPanelPlace, type PanelPlace } from '@/features/business/panel-data'
import { parseTab, tabHref, tabLabel, type PanelTab } from '@/features/business/panel-tabs'
import { PanelSection, type PanelCtx } from './sections'

export const dynamic = 'force-dynamic'

type Admin = ReturnType<typeof createAdminClient>
type SearchParams = { tab?: string | string[]; nuevo?: string | string[] }

const STATUS_LABEL: Record<PlaceVisibility, string> = { visible: 'Publicado', paused: 'Cerrado temporalmente', hidden_by_admin: 'Oculto' }
const headerBtn = 'inline-flex h-[42px] items-center gap-[7px] rounded-full px-4 text-sm font-medium transition'

// Datos del negocio para el panel: rol del usuario, tono de marca y cuántos lugares tiene.
async function loadBusiness(admin: Admin, businessId: string, userId: string) {
  const [{ data: member }, { data: biz }, { count }, { data: memberships }] = await Promise.all([
    admin.from('business_members').select('role').eq('business_id', businessId).eq('user_id', userId).maybeSingle(),
    admin.from('businesses').select('brand_voice').eq('id', businessId).maybeSingle(),
    admin.from('places').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    admin.from('business_members').select('business_id').eq('user_id', userId),
  ])
  // Lugares de TODOS los negocios del usuario (lo que lista "Mis lugares"), para el selector.
  const businessIds = ((memberships ?? []) as { business_id: string }[]).map((m) => m.business_id)
  const owned = businessIds.length > 1
    ? (await admin.from('places').select('id', { count: 'exact', head: true }).in('business_id', businessIds)).count
    : count
  return {
    // null = no es miembro; un miembro sin rol explícito cuenta como 'member'.
    role: member ? ((member as { role: string | null }).role ?? 'member') : null,
    brandVoice: (biz as { brand_voice: string | null } | null)?.brand_voice ?? null,
    placesCount: count ?? 1,
    ownedCount: owned ?? 1,
  }
}

/** Sesión + membresía del lugar. Redirige o responde 404 si no corresponde; no carga nada más antes. */
async function loadContext(placeId: string, tab: PanelTab): Promise<PanelCtx> {
  if (!isUuid(placeId)) notFound()
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(tabHref(placeId, tab))}`)

  const admin = createAdminClient()
  const place = await loadPanelPlace(admin, placeId)
  if (!place) notFound()
  // Verificar membresía ANTES de cargar nada más: el usuario debe pertenecer al negocio dueño.
  if (!place.business_id) redirect('/panel')
  const business = await loadBusiness(admin, place.business_id, user.id)
  if (!business.role) redirect('/panel')

  const visibility: PlaceVisibility = place.is_published ? 'visible' : place.owner_paused_at ? 'paused' : 'hidden_by_admin'
  return {
    place, businessId: place.business_id, role: business.role, brandVoice: business.brandVoice,
    placesCount: business.placesCount, ownedCount: business.ownedCount, visibility, now: Date.now(),
    pendingReviews: await countPendingReviews(admin, placeId),
  }
}

/** Cabecera de la sección: saludo en Resumen, nombre del lugar en el resto, y los atajos. */
function PanelHeader({ place, tab, visibility }: { place: PanelPlace; tab: PanelTab; visibility: PlaceVisibility }) {
  const overview = tab === 'resumen'
  // Oculto: la ficha pública responde 404; el dueño la ve en la vista previa.
  const listingHref = visibility === 'visible' ? `/places/${place.slug}` : `/places/${place.slug}/preview`
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{overview ? 'Resumen · últimos 7 días' : `Panel · ${tabLabel(tab)}`}</p>
        <h1 className="mt-1 text-[clamp(28px,3vw,38px)] font-light leading-[1.1] tracking-[-0.02em] text-fg [overflow-wrap:anywhere]">
          {overview && 'Hola, '}<span className="font-medium">{place.name}</span>
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={listingHref} className={`${headerBtn} border border-line bg-card text-fg hover:border-goospe-green/40`}>
          <Eye size={16} strokeWidth={1.75} aria-hidden="true" /> {visibility === 'visible' ? 'Ver ficha' : 'Vista previa'}
        </Link>
        {/* En Eventos el alta ya está en la propia tarjeta. */}
        {tab !== 'eventos' && (
          <Link href={`${tabHref(place.id, 'eventos')}&nuevo=1`} className={`${headerBtn} bg-goospe-green text-on-brand hover:brightness-105`}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" /> Nuevo evento
          </Link>
        )}
      </div>
    </div>
  )
}

function VisibilityNotice({ visibility }: { visibility: PlaceVisibility }) {
  if (visibility === 'visible') return null
  return (
    <p role="status" className="flex items-start gap-2 rounded-[18px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
      <EyeOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
      {visibility === 'paused' ? 'Tu lugar está cerrado temporalmente: no aparece en Goospe. Reactívalo en “Ficha › Visibilidad”.' : 'Este lugar está oculto por el equipo de Goospe.'}
    </p>
  )
}

export default async function PanelPlacePage({ params, searchParams }: {
  params: Promise<{ placeId: string }>; searchParams: Promise<SearchParams>
}) {
  const [{ placeId }, sp] = await Promise.all([params, searchParams])
  const tab = parseTab(sp.tab)
  const ctx = await loadContext(placeId, tab)
  const { place, visibility } = ctx
  const nav: PanelNavProps = {
    placeId: place.id, placeName: place.name, logoUrl: place.logo_url, statusLabel: STATUS_LABEL[visibility],
    published: visibility === 'visible', multiple: ctx.ownedCount > 1, active: tab, pendingReviews: ctx.pendingReviews,
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className={`${appContainer} grid flex-1 items-start gap-7 pb-14 pt-5 md:pt-7 lg:grid-cols-[250px_minmax(0,1fr)]`}>
        <PanelSidebar {...nav} />

        <div className="flex min-w-0 flex-col gap-[18px]">
          <PanelTopNav {...nav} />
          <PanelHeader place={place} tab={tab} visibility={visibility} />
          <VisibilityNotice visibility={visibility} />
          <PanelSection tab={tab} ctx={ctx} startNewEvent={sp.nuevo === '1'} />
          <PanelSecondaryLinks className="flex flex-wrap gap-x-2 border-t border-line pt-3 lg:hidden" />
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
