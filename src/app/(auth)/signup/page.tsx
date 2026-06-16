import Link from 'next/link'
import { SignupForm } from '@/features/auth/components'

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-goospe-gray">Crea tu cuenta</h1>
      <p className="mb-6 mt-1 text-center text-goospe-gray/70">Guarda lugares y decide más rápido</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-goospe-gray/70">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-goospe-green hover:underline">Entra</Link>
      </p>
    </div>
  )
}
