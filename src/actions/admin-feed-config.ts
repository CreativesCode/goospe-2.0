'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin-guard'
import { audit } from '@/lib/audit'
import type { Json } from '@/lib/database.types'
import {
  DEFAULT_WEIGHTS, FEED_RANKING_KEY, diffWeights, parseWeights, readWeights, type RankingWeights,
} from '@/features/feed/ranking-weights'

type Result = { error?: string; success?: boolean; weights?: RankingWeights; unchanged?: boolean }

// Pesos del ranking del feed (feed_config, fila `feed_ranking`). Solo admin. El cambio se nota
// en la siguiente carga del feed de cualquier usuario: no hay deploy ni caché de por medio,
// salvo la tanda inicial renderizada en servidor, que se revalida aquí.
async function write(next: RankingWeights, action: string): Promise<Result> {
  const { user, admin: isAdmin } = await getAdminUser()
  if (!user || !isAdmin) return { error: 'No autorizado' }

  const admin = createAdminClient()
  const { data: prevRow, error: readErr } = await admin
    .from('feed_config').select('value').eq('key', FEED_RANKING_KEY).maybeSingle()
  if (readErr) {
    console.error('[feed-config] lectura:', readErr.message)
    return { error: 'No pudimos leer la configuración actual. Intenta de nuevo.' }
  }
  const before = readWeights(prevRow?.value)
  const changes = diffWeights(before, next)
  if (Object.keys(changes).length === 0) return { success: true, weights: before, unchanged: true }

  const { error } = await admin
    .from('feed_config')
    .upsert({ key: FEED_RANKING_KEY, value: next as unknown as Json }, { onConflict: 'key' })
  if (error) {
    console.error('[feed-config] escritura:', error.message)
    return { error: 'No pudimos guardar los pesos. Intenta de nuevo.' }
  }

  await audit({
    userId: user.id, action, objectType: 'feed_config', objectId: FEED_RANKING_KEY,
    payload: { changes, before, after: next },
  })
  revalidatePath('/admin/ranking')
  revalidatePath('/feed')
  return { success: true, weights: next }
}

/** Guarda los pesos del ranking. `input`: objeto con las seis claves (números o texto). */
export async function saveFeedWeights(input: unknown): Promise<Result> {
  const parsed = parseWeights(input)
  if (!parsed.ok) return { error: parsed.error }
  return write(parsed.weights, 'admin.feed_weights_update')
}

/** Vuelve a los valores históricos (los que estaban fijos en el SQL). */
export async function resetFeedWeights(): Promise<Result> {
  return write({ ...DEFAULT_WEIGHTS }, 'admin.feed_weights_reset')
}
