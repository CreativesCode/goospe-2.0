import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { absoluteUrl } from '@/lib/email/config'
import { JsonLd } from '@/shared/components/json-ld'

export type Crumb = { label: string; href?: string }

/**
 * Miga de pan con enlaces internos + BreadcrumbList (schema.org). El último elemento es la
 * página actual: va sin enlace.
 */
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  const linked = items.filter((c): c is Required<Crumb> => !!c.href)
  return (
    <nav aria-label="Ruta de navegación" className={`text-sm text-fg-soft ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="inline-flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />}
            {c.href ? (
              <Link href={c.href} className="transition hover:text-ink">{c.label}</Link>
            ) : (
              <span aria-current="page" className="truncate text-fg">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
      {linked.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: linked.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.label,
              item: absoluteUrl(c.href),
            })),
          }}
        />
      )}
    </nav>
  )
}
