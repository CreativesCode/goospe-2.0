// Panel de estadísticas del lugar (presentacional). Recibe los conteos ya agregados.
type Metrics = Record<string, number>

const CARDS: { kind: string; label: string; icon: string }[] = [
  { kind: 'view_detail', label: 'Vistas de ficha', icon: '👁️' },
  { kind: 'view_card', label: 'Apariciones en feed', icon: '📲' },
  { kind: 'save', label: 'Guardados', icon: '❤️' },
  { kind: 'directions', label: 'Cómo llego', icon: '🧭' },
  { kind: 'share', label: 'Compartidos', icon: '📤' },
  { kind: 'concierge_pick', label: 'Elegido por el conserje', icon: '✨' },
]

export function StatsPanel({
  d7, d30, savesTotal, rating, reviewsCount,
}: {
  d7: Metrics; d30: Metrics; savesTotal: number; rating: number; reviewsCount: number
}) {
  const total30 = CARDS.reduce((s, c) => s + (d30[c.kind] ?? 0), 0)

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium text-goospe-gray">Estadísticas</h2>
        <span className="text-xs text-goospe-gray/50">últimos 30 días · (7d)</span>
      </div>

      {total30 === 0 ? (
        <p className="text-sm text-goospe-gray/50">
          Aún no hay actividad registrada. A medida que la gente vea, guarde o pida cómo llegar a
          tu lugar, lo verás aquí.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.kind} className="rounded-xl bg-gray-50 p-3">
              <div className="text-lg">{c.icon}</div>
              <div className="mt-1 text-2xl font-semibold text-goospe-gray">
                {d30[c.kind] ?? 0}
                <span className="ml-1 text-xs font-normal text-goospe-green">({d7[c.kind] ?? 0})</span>
              </div>
              <div className="text-xs text-goospe-gray/60">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-black/5 pt-4 text-sm text-goospe-gray/70">
        <span>❤️ {savesTotal} guardados en total</span>
        <span>⭐ {Number(rating).toFixed(1)} · {reviewsCount} {reviewsCount === 1 ? 'reseña' : 'reseñas'}</span>
      </div>
    </section>
  )
}
