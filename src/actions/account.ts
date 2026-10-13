'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { authErrorMessage } from '@/lib/auth-errors'
import { verifyPassword } from '@/lib/reauth'
import { authCallbackUrl } from '@/lib/site-origin'
import { loadMemberships } from '@/lib/account-memberships'
import {
  DELETION_MESSAGES, blockerMessage, dbBlockReason, decideDeletion,
} from '@/features/profile/account-deletion'
import {
  changeEmailSchema, changePasswordSchema, deleteAccountSchema, firstIssue,
} from '@/features/profile/profile-schema'

// Cuenta: cambiar contraseña, cambiar email y eliminar la cuenta. Las tres piden la contraseña
// ACTUAL (re-autenticación) y actúan SIEMPRE sobre el usuario de la sesión: ninguna recibe un
// id de usuario por el formulario.
const WRONG_PASSWORD = 'La contraseña actual no es correcta.'
const TOO_MANY = 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
const NO_PASSWORD = 'Tu cuenta no tiene contraseña. Crea una desde "Olvidé mi contraseña" y vuelve a intentarlo.'
const AVATAR_BUCKET = 'places'

type AdminClient = ReturnType<typeof createAdminClient>

async function sessionUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return { sb, user }
}

// Tope de intentos de contraseña por cuenta. Falla CERRADO: si el limitador no responde no se
// prueba la contraseña (protege contra fuerza bruta con una sesión robada).
const passwordAttemptAllowed = (userId: string) =>
  rateLimit(`reauth:${userId}`, 900, 8, { failOpen: false })

export async function changePassword(formData: FormData) {
  const { sb, user } = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get('current_password'), new_password: formData.get('new_password'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!user.email) return { error: NO_PASSWORD }
  if (!(await passwordAttemptAllowed(user.id))) return { error: TOO_MANY }
  if ((await verifyPassword(user.email, parsed.data.current_password)) !== user.id) return { error: WRONG_PASSWORD }

  const { error } = await sb.auth.updateUser({ password: parsed.data.new_password })
  if (error) return { error: authErrorMessage(error) }
  await audit({ userId: user.id, action: 'user.password_change', objectType: 'user', objectId: user.id })
  return { success: true }
}

/**
 * Cambio de email: Supabase manda un enlace de confirmación a la dirección NUEVA (y a la
 * actual si el proyecto tiene activado el doble aviso). El email no cambia hasta abrirlo; el
 * enlace aterriza en /auth/callback, igual que el resto de los emails de auth.
 */
export async function changeEmail(formData: FormData) {
  const { sb, user } = await sessionUser()
  if (!user) return { error: 'Inicia sesión para continuar' }
  const parsed = changeEmailSchema.safeParse({
    current_password: formData.get('current_password'), email: formData.get('email'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!user.email) return { error: NO_PASSWORD }
  if (parsed.data.email === user.email.toLowerCase()) return { error: 'Ese ya es tu email' }
  if (!(await passwordAttemptAllowed(user.id))) return { error: TOO_MANY }
  if (!(await rateLimit(`email-change:${user.id}`, 3600, 3))) return { error: 'Ya pediste varios cambios de email. Intenta de nuevo en un rato.' }
  if ((await verifyPassword(user.email, parsed.data.current_password)) !== user.id) return { error: WRONG_PASSWORD }

  const { error } = await sb.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: await authCallbackUrl('/profile/account?email=ok') }
  )
  if (error) return { error: authErrorMessage(error) }
  // Sin las direcciones: la bitácora no guarda emails.
  await audit({ userId: user.id, action: 'user.email_change_request', objectType: 'user', objectId: user.id })
  return { success: true }
}

// Archivos del usuario en Storage: las fotos que aportó (rutas que devuelve la función SQL) y
// su carpeta de avatares. Un fallo aquí no revierte el borrado: queda en logs.
async function removeUserFiles(admin: AdminClient, userId: string, photoPaths: string[]) {
  try {
    const { data: avatars } = await admin.storage.from(AVATAR_BUCKET).list(`avatars/${userId}`, { limit: 100 })
    const paths = [...photoPaths, ...(avatars ?? []).map((f) => `avatars/${userId}/${f.name}`)]
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(AVATAR_BUCKET).remove(paths.slice(i, i + 100))
      if (error) console.error('[deleteAccount] storage:', error.message)
    }
  } catch (e) {
    console.error('[deleteAccount] storage:', (e as Error).message)
  }
}

const stringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * Eliminar MI cuenta. Irreversible.
 *
 * Qué se borra y qué se anonimiza está descrito en la función SQL delete_user_account_data
 * (migración 0042) y en la pantalla (DeleteAccount.tsx). Seguros de este camino:
 *   1. el id a borrar es el de la sesión (cookies); el formulario no trae ningún id;
 *   2. contraseña actual verificada con un cliente aparte y comparada con ese mismo id;
 *   3. confirmación escrita ("ELIMINAR");
 *   4. tope de intentos que falla cerrado;
 *   5. la decisión es una función pura con tests (decideDeletion);
 *   6. la función SQL repite las guardas y corre en una transacción: o todo o nada.
 */
export async function deleteAccount(formData: FormData) {
  const { sb, user } = await sessionUser()
  if (!user) return { error: DELETION_MESSAGES.no_session }
  const parsed = deleteAccountSchema.safeParse({
    current_password: formData.get('current_password'), confirmation: formData.get('confirmation'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!user.email) return { error: NO_PASSWORD }
  if (!(await passwordAttemptAllowed(user.id))) return { error: TOO_MANY }

  const admin = createAdminClient()
  const [reauthUserId, profileRes, memberships] = await Promise.all([
    verifyPassword(user.email, parsed.data.current_password),
    admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    loadMemberships(admin, user.id),
  ])
  // Sin poder leer el contexto no se decide: se falla cerrado.
  if (profileRes.error || !profileRes.data || !memberships) {
    console.error('[deleteAccount] contexto:', profileRes.error?.message ?? 'sin perfil o sin membresías')
    return { error: 'No pudimos verificar tu cuenta. Intenta de nuevo.' }
  }

  const decision = decideDeletion({
    sessionUserId: user.id,
    reauthUserId,
    confirmation: parsed.data.confirmation,
    isAdmin: !!(profileRes.data as { is_admin: boolean | null }).is_admin,
    memberships,
  })
  if (!decision.ok) {
    return decision.reason === 'blocked'
      ? { error: DELETION_MESSAGES.blocked, blockers: decision.blockers.map(blockerMessage) }
      : { error: DELETION_MESSAGES[decision.reason] }
  }
  const userId = decision.userId // = user.id; a partir de aquí no se usa ningún otro id

  const { data: summary, error: dataErr } = await admin.rpc('delete_user_account_data', { p_user_id: userId })
  if (dataErr) {
    console.error('[deleteAccount] datos:', dataErr.message)
    const blocked = dbBlockReason(dataErr.message)
    return { error: blocked ? DELETION_MESSAGES.blocked : 'No pudimos eliminar tu cuenta. No se borró nada; intenta de nuevo.' }
  }
  const counts = (summary ?? {}) as Record<string, unknown>

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) {
    // Los datos ya se limpiaron (es idempotente): reintentar termina de cerrar la cuenta.
    console.error('[deleteAccount] auth:', authErr.message)
    return { error: 'Borramos tus datos, pero no pudimos cerrar la cuenta. Vuelve a intentarlo en un momento.' }
  }

  await removeUserFiles(admin, userId, stringArray(counts.storage_paths))
  // Solo conteos: la bitácora no guarda el email ni el nombre de la cuenta eliminada.
  await audit({
    userId, action: 'user.account_delete', objectType: 'user', objectId: userId,
    payload: {
      reviews: counts.reviews ?? 0, photos: counts.photos ?? 0, claims: counts.claims ?? 0,
      interactions: counts.interactions ?? 0, businesses: counts.businesses ?? 0,
    },
  })

  // Limpia las cookies de sesión (el usuario ya no existe; un error aquí no importa).
  await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
  revalidatePath('/', 'layout')
  return { success: true }
}
