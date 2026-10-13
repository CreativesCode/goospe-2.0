import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import { RankingWeightsForm } from '@/features/admin/RankingWeightsForm'
import { FEED_RANKING_KEY, readWeights } from '@/features/feed/ranking-weights'

export const metadata: Metadata = { title: 'Ranking del feed' }

export const dynamic = 'force-dynamic'

export default async function AdminRankingPage() {
  await requireAdmin('/admin/ranking') // guard propio: el del layout no evita que la página consulte
  const admin = createAdminClient()
  const { data, error } = await admin.from('feed_config').select('value').eq('key', FEED_RANKING_KEY).maybeSingle()
  // Sin fila (migración 0043 sin aplicar) o con un valor inválido, get_feed usa los originales:
  // readWeights aplica la misma regla, así que esto es lo que el feed usa de verdad.
  const weights = readWeights(data?.value)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-fg">Ranking del feed</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-soft">
          Pesos con los que se ordena «Para ti». Se aplican al instante a todos los usuarios, sin
          publicar una versión nueva. Cada cambio queda en la{' '}
          <Link href="/admin/audit?type=feed_config" className="text-goospe-green underline-offset-2 hover:underline">bitácora</Link>.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-fg">
          No pudimos leer la configuración guardada. Se muestran los valores originales; guardar los escribirá.
        </p>
      )}
      {!error && !data && (
        <p role="status" className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-fg">
          Todavía no hay pesos guardados: el feed usa los originales. Si acabas de desplegar, falta
          aplicar la migración 0043 para que el feed lea lo que guardes aquí.
        </p>
      )}

      <RankingWeightsForm initial={weights} />

      <section className="rounded-2xl border border-line bg-card p-5 text-sm text-fg-soft">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Cómo se calcula</h2>
        <p className="font-mono text-xs leading-relaxed text-fg">
          puntaje = cercanía × e^(−distancia ÷ caída) + tendencia × (tendencia del lugar ÷ 5) + variedad × azar fijo del lugar
          + afinidad × parecido con tu gusto + boost (si está destacado)
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>La afinidad solo cuenta para usuarios con sesión y perfil de gusto; el resto ve el feed sin ese término.</li>
          <li>«Abierto ahora» no entra al puntaje: el horario se interpreta en la app, no en la base de datos.</li>
          <li>Dentro de un mismo scroll el orden no se rebaraja: la paginación continúa desde el último lugar visto.</li>
        </ul>
      </section>
    </div>
  )
}
