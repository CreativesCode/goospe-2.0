'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin-guard'
import { audit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { firstIssue, resolveFeedbackSchema } from '@/features/feedback/feedback-schema'

// Bandeja de feedback y correcciones (/admin/feedback). Solo admin. Resolver o descartar NO
// cambia el lugar: la corrección se aplica a mano desde la ficha del admin.
export async function resolveFeedback(formData: FormData) {
  const { user, admin: isAdminUser } = await getAdminUser()
  if (!user || !isAdminUser) return { error: 'No autorizado' }
  const parsed = resolveFeedbackSchema.safeParse({
    feedback_id: formData.get('feedback_id'), decision: formData.get('decision'), note: formData.get('note'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const { feedback_id: id, decision, note } = parsed.data

  const admin = createAdminClient()
  // El filtro de estado va en el UPDATE: dos admins a la vez no resuelven (ni avisan) dos veces.
  const { data, error } = await admin.from('feedback')
    .update({ status: decision, admin_note: note, resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id).eq('status', 'open').select('id, kind, category, user_id, place_id')
  if (error) {
    console.error('[resolveFeedback]', error.message)
    return { error: 'No pudimos guardar. Intenta de nuevo.' }
  }
  const row = (data ?? [])[0] as { id: string; kind: string; category: string; user_id: string | null; place_id: string | null } | undefined
  if (!row) return { error: 'Ese mensaje ya fue resuelto' }

  // Gracias a quien lo envió con sesión, solo si se resolvió (un descarte no se anuncia).
  if (decision === 'resolved' && row.user_id) {
    await notifyUser(row.user_id, {
      kind: 'feedback_resolved',
      title: row.kind === 'correction' ? 'Revisamos tu sugerencia de corrección' : 'Revisamos tu mensaje',
      body: '¡Gracias por ayudarnos a mejorar Goospe!',
      placeId: row.place_id,
    })
  }
  await audit({
    userId: user.id, action: decision === 'resolved' ? 'admin.feedback_resolve' : 'admin.feedback_dismiss',
    objectType: 'feedback', objectId: row.id,
    payload: { kind: row.kind, category: row.category, place_id: row.place_id, note },
  })
  revalidatePath('/admin/feedback')
  return { success: true }
}
