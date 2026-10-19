import { AppNav } from '@/shared/components/app-nav'
import { appContainer } from '@/shared/lib/ui'

const block = 'animate-pulse rounded-[20px] border border-line bg-card'

/**
 * Esqueleto del panel de un lugar: cambiar de sección (`?tab=`) vuelve al servidor, y con el
 * loading a pantalla completa del segmento padre cada cambio taparía la navegación.
 */
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col bg-surface" aria-busy="true">
      <AppNav />
      <div className={`${appContainer} grid items-start gap-7 pb-14 pt-5 md:pt-7 lg:grid-cols-[250px_minmax(0,1fr)]`}>
        <div className={`hidden h-[420px] lg:block ${block}`} />
        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className={`h-16 lg:hidden ${block}`} />
          <div className="h-16" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className={`h-[104px] ${block}`} />)}
          </div>
          <div className={`h-[280px] ${block}`} />
          <span className="sr-only" role="status">Cargando…</span>
        </div>
      </div>
    </main>
  )
}
