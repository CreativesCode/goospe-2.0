import 'server-only'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Regenera la ficha pública de un lugar (/places/[slug], ISR de 1 h) tras un cambio hecho por
 * el dueño o un admin: sin esto la edición tardaba hasta una hora en verse.
 * Nunca lanza: si no se puede resolver el slug, la ficha se regenera sola al vencer el ISR.
 */
export async function revalidatePlace(placeId: string, slug?: string | null): Promise<void> {
  try {
    let s = slug ?? null
    if (!s) {
      const admin = createAdminClient()
      const { data } = await admin.from('places').select('slug').eq('id', placeId).maybeSingle()
      s = (data as { slug: string } | null)?.slug ?? null
    }
    if (s) revalidatePath(`/places/${s}`)
  } catch (e) {
    console.error('[revalidatePlace]', (e as Error).message)
  }
}
