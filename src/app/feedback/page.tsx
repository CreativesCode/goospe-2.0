import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
import { PageHeader } from '@/shared/components/page-header'
import { pageShell } from '@/shared/lib/ui'
import { safeInternalLink } from '@/features/notifications/format'
import { FeedbackForm } from '@/features/feedback/FeedbackForm'
import { GENERAL_CATEGORIES, type GeneralCategory } from '@/features/feedback/feedback-schema'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Enviar comentarios | Goospe',
  description: 'Cuéntanos qué no funciona o qué te gustaría ver en Goospe.',
  alternates: { canonical: '/feedback' },
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// Feedback general, con o sin sesión. `?tema=` preselecciona la categoría y `?desde=` guarda
// la página de origen (solo rutas internas).
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  const tema = one(sp.tema)
  const category = (GENERAL_CATEGORIES as readonly string[]).includes(tema ?? '') ? (tema as GeneralCategory) : null

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <AppNav />
      <div className={pageShell}>
        <div className="max-w-2xl">
        <PageHeader
          kicker="Ayúdanos a mejorar"
          title={<>Enviar <span className="font-medium">comentarios</span></>}
          subtitle="¿Algo no funciona, falta un lugar o tienes una idea? Escríbenos. Para corregir los datos de un lugar, usa “Sugerir una corrección” en su ficha."
        />
        <FeedbackForm signedIn={!!user} initialCategory={category} from={safeInternalLink(one(sp.desde))?.slice(0, 300) ?? null} />
        </div>
      </div>
      <AppFooter />
    </main>
  )
}
