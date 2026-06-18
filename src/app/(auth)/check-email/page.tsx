import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function CheckEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-goospe-green/10 text-goospe-green">
        <MailCheck size={30} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-medium text-fg">Revisa tu correo</h1>
      <p className="text-fg-soft">
        Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y empezar.
      </p>
      <Link href="/login" className="inline-block text-goospe-green hover:underline">Volver a entrar</Link>
    </div>
  )
}
