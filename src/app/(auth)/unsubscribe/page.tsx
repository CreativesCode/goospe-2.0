import type { Metadata } from 'next'
import Link from 'next/link'
import { MailQuestion } from 'lucide-react'
import { UnsubscribeCard } from '@/features/notifications/EmailPreferences'
import { loadPreferences } from '@/lib/email/preferences'
import { readUnsubscribeToken } from '@/lib/email/tokens'

// Baja de emails SIN iniciar sesión: la identidad viene en un token firmado (HMAC) que solo
// pudo generar el servidor al enviar el email. Abrir la página no cambia nada (los antivirus y
// las vistas previas siguen enlaces): la baja se confirma con un botón.
// Vive en el grupo (auth) para compartir la pantalla partida con el panel de marca; la URL sigue siendo /unsubscribe.
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
    <>
      {target && prefs && raw ? (
        <UnsubscribeCard token={raw} category={target.category} subscribed={prefs[target.category]} />
      ) : (
        <div>
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tint text-ink">
            <MailQuestion size={26} strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-[30px] font-light leading-tight tracking-[-0.02em] text-fg">
            Este enlace <span className="font-medium">no es válido</span>
          </h1>
          <p className="mt-1.5 text-fg-soft">
            Abre el enlace del email más reciente que te enviamos o, si tienes cuenta, ajusta tus correos desde tu panel.
          </p>
          <Link href="/panel#emails" className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-goospe-green font-medium text-on-brand transition hover:brightness-105">
            Ir a mi panel
          </Link>
        </div>
      )}
      <p className="mt-6 text-center text-[13px] text-muted">
        <Link href="/feed" className="font-medium text-ink hover:underline">Volver a Goospe</Link>
      </p>
    </>
  )
}
