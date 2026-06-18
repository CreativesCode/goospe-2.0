// Panel de estadísticas del lugar (presentacional). Recibe los conteos ya agregados.
import { Eye, Smartphone, Heart, Compass, Share2, Sparkles, Star, type LucideIcon } from 'lucide-react'

type Metrics = Record<string, number>

const CARDS: { kind: string; label: string; icon: LucideIcon }[] = [
  { kind: 'view_detail', label: 'Vistas de ficha', icon: Eye },
  { kind: 'view_card', label: 'Apariciones en feed', icon: Smartphone },
  { kind: 'save', label: 'Guardados', icon: Heart },
  { kind: 'directions', label: 'Cómo llego', icon: Compass },
  { kind: 'share', label: 'Compartidos', icon: Share2 },
  { kind: 'concierge_pick', label: 'Elegido por el conserje', icon: Sparkles },
]

export function StatsPanel({
  d7, d30, savesTotal, rating, reviewsCount,
}: {
  d7: Metrics; d30: Metrics; savesTotal: number; rating: number; reviewsCount: number
}) {
  const total30 = CARDS.reduce((s, c) => s + (d30[c.kind] ?? 0), 0)

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium text-fg">Estadísticas</h2>
        <span className="text-xs text-muted">últimos 30 días · (7d)</span>
      </div>

      {total30 === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay actividad registrada. A medida que la gente vea, guarde o pida cómo llegar a
          tu lugar, lo verás aquí.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CARDS.map(({ kind, label, icon: Icon }) => (
            <div key={kind} className="rounded-xl bg-surface p-3">
              <Icon size={18} strokeWidth={1.75} className="text-goospe-green" />
              <div className="mt-1 text-2xl font-semibold text-fg">
                {d30[kind] ?? 0}
                <span className="ml-1 text-xs font-normal text-goospe-green">({d7[kind] ?? 0})</span>
              </div>
              <div className="text-xs text-fg-soft">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-4 text-sm text-fg-soft">
        <span className="inline-flex items-center gap-1.5"><Heart size={15} strokeWidth={1.75} className="text-goospe-green" /> {savesTotal} guardados en total</span>
        <span className="inline-flex items-center gap-1.5"><Star size={15} strokeWidth={1.75} className="text-goospe-green" fill="currentColor" /> {Number(rating).toFixed(1)} · {reviewsCount} {reviewsCount === 1 ? 'reseña' : 'reseñas'}</span>
      </div>
    </section>
  )
}
