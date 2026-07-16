import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { RsvpButton } from '@/features/events/RsvpButton'
import { AttendanceCounts } from '@/features/events/AttendanceCounts'
import Link from 'next/link'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PhotoImg } from '@/shared/components/photo-img'

// Conteos agregados de asistentes por evento (solo números, sin PII). El RPC es SECURITY
// DEFINER; si aún no está aplicado en la BD, degradamos a un mapa vacío (no muestra conteos).
type EventStat = { event_id: string; going: number; male: number; female: number }
async function fetchStats(sb: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Record<string, EventStat>> {
  if (!ids.length) return {}
  const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
  try {
    const { data } = await rpc('event_gender_stats', { p_event_ids: ids })
    return Object.fromEntries(((data as EventStat[] | null) ?? []).map((r) => [r.event_id, r]))
  } catch {
    return {}
  }
}

// ISR: cartelera de eventos. Se regenera cada 10 min (los eventos no son tiempo real,
// pero sí sensibles a la fecha → ventana corta para no mostrar eventos ya pasados).
export const revalidate = 600

export const metadata: Metadata = {
  title: 'Eventos cerca de ti | Goospe',
  description:
    'Qué hacer esta semana cerca de ti: conciertos, ferias y panoramas. Confirma tu asistencia con un toque.',
  alternates: { canonical: '/events' },
}

const fmt = (s: string) =>
  new Date(s).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default async function EventosPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('events')
    .select('id, name, description, image_url, starts_at, places(slug, name)')
    .eq('status', 'approved')
    .gte('starts_at', new Date(Date.now() - 86400_000).toISOString())
    .order('starts_at')
    .limit(60)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (data ?? []) as any[]
  const stats = await fetchStats(sb, events.map((e) => e.id as string))

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />

      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="mb-1 text-3xl font-medium text-fg">Próximos eventos</h1>
        <p className="mb-6 text-fg-soft">Lo que viene en los lugares cerca de ti.</p>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-80" />
            <p className="text-fg-soft">Aún no hay eventos próximos. Mientras tanto, descubre lugares cerca de ti.</p>
            <Link
              href="/feed"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-goospe-green px-5 py-2.5 text-sm font-medium text-white transition hover:bg-goospe-green-dark"
            >
              Explorar lugares
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li key={ev.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                <div className="flex">
                  {ev.image_url ? (
                    <PhotoImg src={ev.image_url} alt={ev.name} className="h-32 w-32 shrink-0 object-cover" />
                  ) : (
                    <div className="flex h-32 w-32 shrink-0 items-center justify-center bg-goospe-gradient">
                      <img src="/brand/isotipo-white.svg" alt="" className="h-9 w-9 opacity-90" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="text-xs font-medium capitalize text-goospe-green">{fmt(ev.starts_at)}</p>
                      <h2 className="mt-0.5 font-medium text-fg">{ev.name}</h2>
                      {ev.places && (
                        <Link href={`/places/${ev.places.slug}`} className="text-sm text-fg-soft hover:text-goospe-green">
                          en {ev.places.name}
                        </Link>
                      )}
                    </div>
                    {(() => { const s = stats[ev.id]; return s ? <AttendanceCounts going={Number(s.going)} male={Number(s.male)} female={Number(s.female)} className="mt-1 text-fg-soft" /> : null })()}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {ev.description && <p className="line-clamp-1 text-sm text-fg-soft">{ev.description}</p>}
                      <RsvpButton eventId={ev.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
