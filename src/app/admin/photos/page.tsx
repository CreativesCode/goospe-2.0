import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ModerationActions } from '@/features/photos/ModerationActions'

export const dynamic = 'force-dynamic'

export default async function AdminFotosPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('place_photos')
    .select('id, url, source, created_at, places(slug, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (data ?? []) as any[]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-fg">Fotos por revisar · {pending.length}</h1>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
            <CheckCircle2 size={28} strokeWidth={1.5} />
          </span>
          <p className="text-fg-soft">No hay fotos pendientes. Todo al día.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((ph) => (
            <div key={ph.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm">
                  {ph.places ? (
                    <Link href={`/places/${ph.places.slug}`} className="font-medium text-fg hover:text-goospe-green">
                      {ph.places.name}
                    </Link>
                  ) : <span className="text-muted">—</span>}
                  <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-muted">{ph.source ?? '?'}</span>
                </div>
                <ModerationActions photoId={ph.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
