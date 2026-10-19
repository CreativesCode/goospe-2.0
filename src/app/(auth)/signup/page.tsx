import { AuthHeading, AuthTabs, ExploreWithoutAccount, SignupForm } from '@/features/auth/components'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div>
      <AuthTabs active="signup" next={next} />
      <AuthHeading className="mt-7" title="Crea tu cuenta" subtitle="Gratis. Tarda menos de un minuto." />
      <SignupForm />
      <ExploreWithoutAccount />
    </div>
  )
}
