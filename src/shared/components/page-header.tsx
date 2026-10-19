import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { eyebrow, pageTitle } from '@/shared/lib/ui'

/**
 * Encabezado de página del rediseño: enlace "volver" opcional, eyebrow, título de marca
 * (peso 300; la palabra clave va en `<span className="font-medium">`), subtítulo y acciones.
 */
export function PageHeader({
  back,
  kicker,
  title,
  subtitle,
  actions,
}: {
  back?: { href: string; label: string }
  kicker?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-7">
      {back && (
        <Link href={back.href} className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-soft transition hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.75} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker && <div className={`${eyebrow} mb-2`}>{kicker}</div>}
          <h1 className={pageTitle}>{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-3 max-w-2xl text-fg-soft">{subtitle}</p>}
    </header>
  )
}
