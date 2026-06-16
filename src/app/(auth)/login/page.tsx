import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components'

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-center text-2xl font-medium text-goospe-gray">Bienvenido de vuelta</h1>
      <p className="mb-6 mt-1 text-center text-goospe-gray/70">Entra a tu cuenta Goospe</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-goospe-gray/70">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="text-goospe-green hover:underline">Regístrate</Link>
      </p>
    </div>
  )
}
