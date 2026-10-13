import type { Metadata } from 'next'
import { MessageSquareText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/shared/components/app-nav'
import { AppFooter } from '@/shared/components/app-footer'
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
      <div className="mx-auto w-full max-w-xl px-5 py-8">
        <h1 className="inline-flex items-center gap-2 text-2xl font-medium text-fg">
          <MessageSquareText size={22} strokeWidth={1.75} className="text-goospe-green" /> Enviar comentarios
        </h1>
        <p className="mb-6 mt-1 text-sm text-fg-soft">
          ¿Algo no funciona, falta un lugar o tienes una idea? Escríbenos. Para corregir los datos de un lugar, usa “Sugerir una corrección” en su ficha.
        </p>
        <FeedbackForm signedIn={!!user} initialCategory={category} from={safeInternalLink(one(sp.desde))?.slice(0, 300) ?? null} />
      </div>
      <AppFooter />
    </main>
  )
}
