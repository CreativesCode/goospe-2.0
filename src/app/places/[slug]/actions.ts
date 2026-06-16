'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// NOTA: acción de curación TEMPORAL para la vista de validación. Sin auth todavía:
// antes de exponer esto en producción hay que protegerla (solo admin / dueño del negocio).
export async function deletePhoto(formData: FormData) {
  const id = String(formData.get('id'))
  const path = String(formData.get('path') ?? '')
  const slug = String(formData.get('slug'))
  const sb = createAdminClient()

  if (path) await sb.storage.from('places').remove([path])
  await sb.from('place_photos').delete().eq('id', id)
  revalidatePath(`/places/${slug}`)
}
