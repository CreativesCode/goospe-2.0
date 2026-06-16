import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">📬</div>
      <h1 className="text-2xl font-medium text-goospe-gray">Revisa tu correo</h1>
      <p className="text-goospe-gray/70">
        Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y empezar.
      </p>
      <Link href="/login" className="inline-block text-goospe-green hover:underline">Volver a entrar</Link>
    </div>
  )
}
