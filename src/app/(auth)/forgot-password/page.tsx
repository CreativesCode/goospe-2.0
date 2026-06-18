import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components'

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-fg">Recuperar contraseña</h1>
      <p className="mb-6 mt-1 text-center text-fg-soft">Te enviamos un enlace por correo</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-fg-soft">
        <Link href="/login" className="text-goospe-green hover:underline">Volver a entrar</Link>
      </p>
    </div>
  )
}
