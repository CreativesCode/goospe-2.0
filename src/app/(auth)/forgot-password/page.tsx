import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components'

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-goospe-gray">Recuperar contraseña</h1>
      <p className="mb-6 mt-1 text-center text-goospe-gray/70">Te enviamos un enlace por correo</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-goospe-gray/70">
        <Link href="/login" className="text-goospe-green hover:underline">Volver a entrar</Link>
      </p>
    </div>
  )
}
