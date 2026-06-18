import { UpdatePasswordForm } from '@/features/auth/components'

export default function UpdatePasswordPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-fg">Nueva contraseña</h1>
      <p className="mb-6 mt-1 text-center text-fg-soft">Define tu nueva contraseña</p>
      <UpdatePasswordForm />
    </div>
  )
}
