import { Suspense } from 'react'
import { AuthHeading, AuthTabs, ExploreWithoutAccount, LoginForm } from '@/features/auth/components'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div>
      <AuthTabs active="login" next={next} />
      <AuthHeading className="mt-7" title="Bienvenido de vuelta" subtitle="Entra para ver tus guardados y eventos." />
      <Suspense>
        <LoginForm />
      </Suspense>
      <ExploreWithoutAccount />
    </div>
  )
}
