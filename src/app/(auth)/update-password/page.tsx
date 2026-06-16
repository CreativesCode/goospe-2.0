import { UpdatePasswordForm } from '@/features/auth/components'

export default function UpdatePasswordPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-goospe-gray">Nueva contraseña</h1>
      <p className="mb-6 mt-1 text-center text-goospe-gray/70">Define tu nueva contraseña</p>
      <UpdatePasswordForm />
    </div>
  )
}
