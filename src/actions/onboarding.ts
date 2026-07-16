'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedQuery } from '@/lib/ai/openai'

// Onboarding: ≤3 preguntas → guarda preferencias en profiles.onboarding y construye el
// perfil de gusto (taste_profiles): resumen textual + embedding. El feed (get_feed) usa
// ese embedding para personalizar el ranking. taste_profiles no tiene policy de write →
// admin client.
const CATEGORY_LABEL: Record<string, string> = {
  comer: 'comer', cafe: 'tomar café', beber: 'bares y tragos', noche: 'vida nocturna', eventos: 'eventos',
}
const BUDGET_LABEL: Record<string, string> = {
  '1': 'económico', '2': 'medio', '3': 'alto', '4': 'premium',
}

const VALID_GENDERS = new Set(['male', 'female', 'other'])

export async function saveOnboarding(formData: FormData) {
  const likes = formData.getAll('likes').map(String) // categorías + vibes
  const budget = (formData.get('budget') as string) || ''
  const genderRaw = (formData.get('gender') as string) || ''
  const gender = VALID_GENDERS.has(genderRaw) ? genderRaw : null

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (likes.length === 0) return { error: 'Elige al menos una cosa que te guste' }

  const cats = likes.filter((l) => l in CATEGORY_LABEL)
  const vibes = likes.filter((l) => !(l in CATEGORY_LABEL))

  const parts: string[] = []
  if (cats.length) parts.push(`Le gusta ${cats.map((c) => CATEGORY_LABEL[c]).join(', ')}`)
  if (vibes.length) parts.push(`Busca ambientes: ${vibes.join(', ')}`)
  if (budget) parts.push(`Presupuesto ${BUDGET_LABEL[budget] ?? budget}`)
  const summary = parts.join('. ') + '.'

  const catAffinity: Record<string, number> = {}
  for (const c of cats) catAffinity[c] = 1

  const admin = createAdminClient()

  // perfil crudo (gender se guarda aquí para el desglose agregado de asistentes por evento)
  await admin
    .from('profiles')
    .update({ onboarding: { likes, budget, gender } } as never)
    .eq('id', user.id)

  // perfil de gusto + embedding
  let embedding: number[] | null = null
  try {
    embedding = await embedQuery(summary)
  } catch {
    embedding = null // si falla la IA, igual guardamos preferencias; el feed usa el fallback
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    summary,
    cat_affinity: catAffinity,
    updated_at: new Date().toISOString(),
  }
  if (embedding) payload.embedding = JSON.stringify(embedding)

  const { error } = await admin
    .from('taste_profiles')
    .upsert(payload as never, { onConflict: 'user_id' })
  if (error) return { error: error.message }

  revalidatePath('/feed')
  return { success: true }
}
