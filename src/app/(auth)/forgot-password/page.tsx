import { AuthHeading, BackToLogin, ForgotPasswordForm } from '@/features/auth/components'
import { authReasonMessage } from '@/lib/auth-errors'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // `?error=expired`: el enlace de recuperación venció (lo envían /auth/callback y /update-password).
  const notice = authReasonMessage((await searchParams).error)
  return (
    <div>
      <AuthHeading title="Recuperar contraseña" subtitle="Te enviamos un enlace por correo." />
      <ForgotPasswordForm notice={notice} />
      <BackToLogin />
    </div>
  )
}
