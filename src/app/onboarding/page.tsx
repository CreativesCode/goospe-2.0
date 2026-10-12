import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm, type OnboardingInitial } from '@/features/onboarding/OnboardingForm'

export const dynamic = 'force-dynamic'

type Stored = { likes?: unknown; budget?: unknown; gender?: unknown } | null

// Lee lo ya guardado y lo pasa al formulario. Antes la página era solo cliente y abría
// siempre vacía: guardar desde "Mis gustos" sobreescribía todo lo anterior.
export default async function OnboardingPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/onboarding')

  const { data } = await sb.from('profiles').select('onboarding').eq('id', user.id).maybeSingle()
  const stored = ((data as { onboarding: Stored } | null)?.onboarding ?? null) as Stored

  const initial: OnboardingInitial | null = stored
    ? {
        likes: Array.isArray(stored.likes) ? stored.likes.filter((l): l is string => typeof l === 'string') : [],
        budget: typeof stored.budget === 'string' ? stored.budget : '',
        gender: typeof stored.gender === 'string' ? stored.gender : '',
      }
    : null

  return <OnboardingForm initial={initial} />
}
