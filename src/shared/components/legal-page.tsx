import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'

/**
 * Shell común para páginas legales (términos, privacidad). Tipografía manual
 * (sin plugin typography): títulos y párrafos legibles sobre el fondo de marca.
 */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="text-3xl font-medium text-fg sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última actualización: {updatedAt}</p>
        <div className="mt-8 space-y-6 text-fg-soft [&_a]:text-goospe-green [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-fg [&_li]:ml-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </article>
      <AppFooter />
    </main>
  )
}
