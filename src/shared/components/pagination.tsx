import Link from 'next/link'
import { pageHref } from '@/lib/pagination'

const on = 'rounded-full border border-line bg-card px-4 py-2 font-medium text-fg-soft transition hover:text-fg'
const off = 'rounded-full border border-line px-4 py-2 text-muted opacity-50'

/** Anterior / Siguiente con enlaces reales (rastreables). No pinta nada si hay una sola página. */
export function Pagination({ basePath, page, pages }: { basePath: string; page: number; pages: number }) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-3 text-sm">
      {page > 1
        ? <Link href={pageHref(basePath, page - 1)} rel="prev" className={on}>Anterior</Link>
        : <span className={off}>Anterior</span>}
      <span className="text-muted">Página {page} de {pages}</span>
      {page < pages
        ? <Link href={pageHref(basePath, page + 1)} rel="next" className={on}>Siguiente</Link>
        : <span className={off}>Siguiente</span>}
    </nav>
  )
}
