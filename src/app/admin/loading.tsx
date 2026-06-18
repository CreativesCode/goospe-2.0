/** Skeleton de carga para cualquier pantalla del backoffice. */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-48 rounded-lg bg-line" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-line bg-card" />
    </div>
  )
}
