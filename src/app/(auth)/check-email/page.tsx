import { MailCheck } from 'lucide-react'
import { AuthHeading, BackToLogin } from '@/features/auth/components'

export default function CheckEmailPage() {
  return (
    <div>
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] bg-tint text-ink">
        <MailCheck size={26} strokeWidth={1.75} />
      </div>
      <AuthHeading
        title="Revisa tu correo"
        subtitle="Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y empezar."
      />
      <BackToLogin />
    </div>
  )
}
