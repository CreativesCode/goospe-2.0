import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Camera, ChevronLeft, Heart, MessageSquare, Star, Ticket, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PhotoImg } from '@/shared/components/photo-img'
import { fmtInZone } from '@/lib/tz'
import { eventPath } from '@/features/places/seo-routes'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mi actividad | Goospe', robots: { index: false } }

const LIMIT = 50
type Tab = 'resenas' | 'eventos' | 'fotos'
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'resenas', label: 'Reseñas', icon: Star },
  { key: 'eventos', label: 'Eventos', icon: Ticket },
  { key: 'fotos', label: 'Fotos', icon: Camera },
]

type PlaceRef = { name: string; slug: string } | null
type ReviewRow = {
  id: string; rating: number; body: string | null; status: string | null; created_at: string | null
  owner_reply: string | null; owner_replied_at: string | null; places: PlaceRef
}
type RsvpRow = {
  status: string; created_at: string | null
  events: { id: string; name: string; starts_at: string; status: string | null; places: { name: string; slug: string; cities: { timezone: string } | null } | null } | null
}
type PhotoRow = { id: string; url: string; status: string | null; created_at: string | null; places: PlaceRef }

// Estado de moderación tal como lo entiende la persona.
const STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Publicada', cls: 'bg-goospe-green/10 text-goospe-green-dark' },
  pending: { label: 'En revisión', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  blocked: { label: 'Oculta por moderación', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}
const fallbackStatus = { label: 'No visible', cls: 'bg-line text-fg-soft' }

function StatusPill({ status }: { status: string | null }) {
  const s = STATUS[status ?? ''] ?? fallbackStatus
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }) : ''

function Empty({ text, cta, href }: { text: string; cta: string; href: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-10 text-center">
      <p className="text-sm text-fg-soft">{text}</p>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-goospe-gradient px-5 text-sm font-medium text-white shadow">{cta}</Link>
    </div>
  )
}

function Reviews({ rows }: { rows: ReviewRow[] }) {
  if (!rows.length) return <Empty text="Aún no has escrito reseñas." cta="Explorar lugares" href="/feed" />
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            {r.places
              ? <Link href={`/places/${r.places.slug}`} className="font-medium text-fg hover:text-goospe-green">{r.places.name}</Link>
              : <span className="font-medium text-fg">Lugar no disponible</span>}
            <StatusPill status={r.status} />
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-fg-soft">
            <span aria-label={`${r.rating} de 5 estrellas`} className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(Math.max(0, 5 - r.rating))}</span></span>
            <span className="text-xs text-muted">{day(r.created_at)}</span>
          </p>
          {r.body && <p className="mt-2 whitespace-pre-line text-sm text-fg-soft [overflow-wrap:anywhere]">{r.body}</p>}
          {r.status === 'blocked' && <p className="mt-2 text-xs text-muted">Esta reseña no cumple las normas de contenido y no es visible para los demás.</p>}
          {r.owner_reply && (
            <div className="mt-3 rounded-xl bg-goospe-green/[0.06] px-3 py-2 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-goospe-green-dark">
                <MessageSquare size={13} strokeWidth={1.75} /> Respuesta del negocio{r.owner_replied_at ? ` · ${day(r.owner_replied_at)}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-line text-fg-soft [overflow-wrap:anywhere]">{r.owner_reply}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

const isPast = (iso: string) => new Date(iso).getTime() < Date.now()

function Rsvps({ rows }: { rows: RsvpRow[] }) {
  if (!rows.length) return <Empty text="Aún no te has apuntado a ningún evento." cta="Ver eventos" href="/events" />
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const ev = r.events
        if (!ev) return null
        const past = isPast(ev.starts_at)
        const cancelled = ev.status === 'cancelled'
        const when = fmtInZone(ev.starts_at, ev.places?.cities?.timezone ?? null, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        return (
          <li key={`${ev.id}-${i}`} className={`rounded-2xl border border-line bg-card p-4 ${past || cancelled ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={eventPath(ev.id)} className="font-medium text-fg hover:text-goospe-green">{ev.name}</Link>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cancelled ? 'bg-red-500/10 text-red-600 dark:text-red-400' : past ? 'bg-line text-fg-soft' : 'bg-goospe-green/10 text-goospe-green-dark'}`}>
                {cancelled ? 'Cancelado' : past ? 'Ya pasó' : r.status === 'interested' ? 'Me interesa' : 'Asistiré'}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-soft">{when} h</p>
            {ev.places && <Link href={`/places/${ev.places.slug}`} className="mt-1 inline-block text-sm text-goospe-green hover:underline">{ev.places.name}</Link>}
          </li>
        )
      })}
    </ul>
  )
}

function Photos({ rows }: { rows: PhotoRow[] }) {
  if (!rows.length) return <Empty text="Aún no has aportado fotos. Puedes hacerlo desde la ficha de cualquier lugar." cta="Explorar lugares" href="/feed" />
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="aspect-square overflow-hidden">
            <PhotoImg src={p.url} alt={p.places ? `Tu foto de ${p.places.name}` : 'Tu foto'} className="h-full w-full object-cover" fallback={<Camera size={32} strokeWidth={1.5} />} />
          </div>
          <div className="space-y-1.5 p-3">
            {p.places
              ? <Link href={`/places/${p.places.slug}`} className="line-clamp-1 block text-sm font-medium text-fg hover:text-goospe-green">{p.places.name}</Link>
              : <span className="text-sm text-fg-soft">Lugar no disponible</span>}
            <StatusPill status={p.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/profile/activity')

  const raw = (await searchParams).tab
  const wanted = Array.isArray(raw) ? raw[0] : raw
  const tab: Tab = TABS.some((t) => t.key === wanted) ? (wanted as Tab) : 'resenas'

  // Reseñas: con el cliente del usuario (la RLS deja ver las propias en cualquier estado).
  // RSVP y fotos: la RLS pública solo muestra eventos y fotos aprobados, así que se leen con
  // service role DESPUÉS de validar la sesión y siempre filtrando por el id de esa sesión.
  let content: React.ReactNode
  let count = 0
  if (tab === 'resenas') {
    const { data } = await sb.from('reviews')
      .select('id, rating, body, status, created_at, owner_reply, owner_replied_at, places(name, slug)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT)
    const rows = (data ?? []) as unknown as ReviewRow[]
    count = rows.length
    content = <Reviews rows={rows} />
  } else if (tab === 'eventos') {
    const { data } = await createAdminClient().from('event_rsvps')
      .select('status, created_at, events(id, name, starts_at, status, places(name, slug, cities(timezone)))')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT)
    const rows = ((data ?? []) as unknown as RsvpRow[])
      .filter((r) => r.events)
      .sort((a, b) => new Date(b.events!.starts_at).getTime() - new Date(a.events!.starts_at).getTime())
    count = rows.length
    content = <Rsvps rows={rows} />
  } else {
    const { data } = await createAdminClient().from('place_photos')
      .select('id, url, status, created_at, places(name, slug)')
      .eq('author_id', user.id).eq('source', 'user').order('created_at', { ascending: false }).limit(LIMIT)
    const rows = (data ?? []) as unknown as PhotoRow[]
    count = rows.length
    content = <Photos rows={rows} />
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <Link href="/profile" className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-soft hover:text-fg"><ChevronLeft size={16} /> Mi perfil</Link>
        <h1 className="mt-1 text-2xl font-medium text-fg">Mi actividad</h1>

        <nav aria-label="Secciones de mi actividad" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={key === 'resenas' ? '/profile/activity' : `/profile/activity?tab=${key}`} aria-current={tab === key ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${tab === key ? 'border-goospe-green bg-goospe-green/10 text-goospe-green-dark' : 'border-line bg-card text-fg-soft hover:text-fg'}`}>
              <Icon size={16} strokeWidth={1.75} /> {label}
            </Link>
          ))}
          <Link href="/saved" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-medium text-fg-soft transition hover:text-fg">
            <Heart size={16} strokeWidth={1.75} /> Guardados
          </Link>
        </nav>

        <div className="mt-5">{content}</div>
        {count >= LIMIT && <p className="mt-3 text-center text-xs text-muted">Se muestran los {LIMIT} más recientes.</p>}
      </div>
      <AppFooter />
    </main>
  )
}
