import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { RsvpButton } from '@/features/events/RsvpButton'

export const dynamic = 'force-dynamic'

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

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/feed" className="text-sm text-goospe-gray/70 hover:text-goospe-green">← Feed</Link>
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-6" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="mb-1 text-3xl font-medium text-goospe-gray">Eventos en Puerto Varas</h1>
        <p className="mb-6 text-goospe-gray/60">Lo que viene en los lugares de la ciudad.</p>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <img src="/brand/isotipo-color.svg" alt="" className="h-14 w-14 opacity-80" />
            <p className="text-goospe-gray/60">Aún no hay eventos próximos. Vuelve pronto.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li key={ev.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                <div className="flex">
                  {ev.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.image_url} alt={ev.name} className="h-32 w-32 shrink-0 object-cover" />
                  ) : (
                    <div className="flex h-32 w-32 shrink-0 items-center justify-center bg-goospe-gradient">
                      <img src="/brand/isotipo-white.svg" alt="" className="h-9 w-9 opacity-90" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="text-xs font-medium capitalize text-goospe-green">{fmt(ev.starts_at)}</p>
                      <h2 className="mt-0.5 font-medium text-goospe-gray">{ev.name}</h2>
                      {ev.places && (
                        <Link href={`/places/${ev.places.slug}`} className="text-sm text-goospe-gray/60 hover:text-goospe-green">
                          en {ev.places.name}
                        </Link>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {ev.description && <p className="line-clamp-1 text-sm text-goospe-gray/60">{ev.description}</p>}
                      <RsvpButton eventId={ev.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
