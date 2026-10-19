import type { Metadata } from 'next'
import Link from 'next/link'
import { MailQuestion } from 'lucide-react'
import { UnsubscribeCard } from '@/features/notifications/EmailPreferences'
import { loadPreferences } from '@/lib/email/preferences'
import { readUnsubscribeToken } from '@/lib/email/tokens'

// Baja de emails SIN iniciar sesión: la identidad viene en un token firmado (HMAC) que solo
// pudo generar el servidor al enviar el email. Abrir la página no cambia nada (los antivirus y
// las vistas previas siguen enlaces): la baja se confirma con un botón.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Preferencias de email | Goospe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer', // el token va en la URL: no debe viajar a otros sitios
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  const raw = typeof token === 'string' ? token : null
  const target = readUnsubscribeToken(raw)
  const prefs = target ? await loadPreferences(target.userId) : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
        {target && prefs && raw ? (
          <UnsubscribeCard token={raw} category={target.category} subscribed={prefs[target.category]} />
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tint text-ink">
              <MailQuestion size={30} strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-medium text-fg">Este enlace no es válido</h1>
            <p className="text-fg-soft">
              Abre el enlace del email más reciente que te enviamos o, si tienes cuenta, ajusta tus correos desde tu panel.
            </p>
            <Link href="/panel#emails" className="inline-block text-ink hover:underline">Ir a mi panel</Link>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/feed" className="hover:underline">Volver a Goospe</Link>
        </p>
      </div>
    </main>
  )
}
