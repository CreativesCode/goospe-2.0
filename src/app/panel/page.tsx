import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ArrowRight, Store, MapPinPlus } from 'lucide-react'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PhotoImg } from '@/shared/components/photo-img'
import { MyRequests } from '@/features/business/MyRequests'
import { loadMyRequests } from '@/features/business/panel-data'
import { EmailPreferences } from '@/features/notifications/EmailPreferences'
import { OWNER_CATEGORIES } from '@/lib/email/categories'
import { loadPreferences } from '@/lib/email/preferences'

export const dynamic = 'force-dynamic'

type OwnedPlace = {
  id: string
  slug: string
  name: string
  vibe_line: string | null
  is_published: boolean
  cover_url: string | null
  owner_paused_at: string | null
  place_photos: { url: string; status: string | null }[]
}

const statusOf = (p: OwnedPlace) =>
  p.is_published ? 'Publicado' : p.owner_paused_at ? 'Cerrado temporalmente' : 'Oculto'

export default async function PanelPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel')

  const admin = createAdminClient()
  const [{ data: memberships }, requests] = await Promise.all([
    admin.from('business_members').select('business_id').eq('user_id', user.id),
    loadMyRequests(admin, user.id),
  ])
  const businessIds = ((memberships ?? []) as { business_id: string }[]).map((m) => m.business_id)

  let places: OwnedPlace[] = []
  if (businessIds.length) {
    const { data } = await admin
      .from('places')
      .select('id, slug, name, vibe_line, is_published, cover_url, owner_paused_at, place_photos(url, status)')
      .in('business_id', businessIds)
      .order('name')
    places = (data ?? []) as unknown as OwnedPlace[]
  }
  const emailPrefs = businessIds.length ? await loadPreferences(user.id, admin) : null
  // Solo las pendientes: con todo rechazado se vuelve a ofrecer "Reclamar mi negocio".
  const hasRequests = [...requests.claims, ...requests.changes, ...requests.proposals].some((r) => r.status === 'pending')

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-medium text-fg">Mis lugares</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/panel/propose"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg"
            >
              <MapPinPlus size={16} strokeWidth={1.75} /> Proponer un lugar nuevo
            </Link>
            <Link
              href="/panel/claim"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-goospe-gradient px-5 py-2 text-sm font-medium text-white shadow"
            >
              <Plus size={16} strokeWidth={2} /> Reclamar un lugar
            </Link>
          </div>
        </div>

        {places.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-card px-4 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
              <Store size={30} strokeWidth={1.5} />
            </span>
            <p className="text-lg font-medium text-fg">Aún no administras ningún lugar</p>
            <p className="max-w-sm text-sm text-fg-soft">
              {hasRequests
                ? 'Tu solicitud está abajo. Te avisaremos por la campana cuando la revisemos.'
                : 'Reclama tu negocio para editar su ficha, fotos y datos de contacto.'}
            </p>
            {!hasRequests && (
              <Link href="/panel/claim" className="mt-2 rounded-full bg-goospe-gradient px-6 py-2.5 text-sm font-medium text-white shadow">
                Reclamar mi negocio
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((p) => {
              // La portada del dueño manda; si no hay, la primera foto aprobada.
              const photo = p.cover_url || p.place_photos?.find((ph) => ph.status === 'approved')?.url
              return (
                <Link
                  key={p.id}
                  href={`/panel/${p.id}`}
                  className="group overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <PhotoImg src={photo} alt={p.name} className="h-full w-full object-cover" isoClassName="h-10 w-10" />
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 font-medium text-fg [overflow-wrap:anywhere]">{p.name}</h2>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.is_published ? 'bg-goospe-green/10 text-goospe-green-dark' : 'bg-line text-muted'}`}>
                        {statusOf(p)}
                      </span>
                    </div>
                    {p.vibe_line && <p className="text-sm text-goospe-green">{p.vibe_line}</p>}
                    <p className="inline-flex items-center gap-1 pt-1 text-xs text-muted group-hover:text-goospe-green">Administrar <ArrowRight size={12} strokeWidth={1.75} /></p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <MyRequests claims={requests.claims} changes={requests.changes} proposals={requests.proposals} />
        </div>

        {/* Preferencias de email: solo para quien ya administra un lugar. */}
        {emailPrefs && (
          <div className="mt-8">
            <EmailPreferences categories={OWNER_CATEGORIES} initial={emailPrefs} />
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
