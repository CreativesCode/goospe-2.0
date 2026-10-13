// Decisión de "eliminar mi cuenta". Módulo PURO (sin red ni BD) para poder probarlo entero:
// la server action (src/actions/account.ts) solo reúne los datos, llama a `decideDeletion`
// y ejecuta si la respuesta es `ok`. La función SQL delete_user_account_data (0042) repite
// las guardas de admin y de último dueño como última línea de defensa.

export const DELETE_CONFIRM_PHRASE = 'ELIMINAR'

/** La confirmación escrita: la palabra exacta, sin distinguir mayúsculas ni espacios alrededor. */
export function confirmationMatches(input: unknown): boolean {
  return typeof input === 'string' && input.trim().toUpperCase() === DELETE_CONFIRM_PHRASE
}

export type Membership = {
  businessId: string
  businessName: string
  /** Rol del usuario en el negocio (la columna admite null: cuenta como dueño). */
  role: string | null
  /** Nombres de los lugares del negocio. */
  placeNames: string[]
  /** Otros miembros con rol de dueño (sin contar al usuario). */
  otherOwners: number
  /** Otros miembros de cualquier rol (sin contar al usuario). */
  otherMembers: number
}

export type DeletionBlocker =
  | { code: 'admin' }
  | { code: 'last_owner'; businessId: string; businessName: string; placeNames: string[] }

/**
 * Qué impide borrar la cuenta:
 *  · es una cuenta de administración;
 *  · es el último dueño de un negocio que tiene lugares: quedarían reclamados sin nadie detrás.
 *    Goospe los libera antes (vuelven a "sin reclamar") y entonces la cuenta se puede eliminar.
 */
export function deletionBlockers(ctx: { isAdmin: boolean; memberships: Membership[] }): DeletionBlocker[] {
  const out: DeletionBlocker[] = []
  if (ctx.isAdmin) out.push({ code: 'admin' })
  for (const m of ctx.memberships) {
    if (m.placeNames.length > 0 && m.otherOwners === 0) {
      out.push({ code: 'last_owner', businessId: m.businessId, businessName: m.businessName, placeNames: m.placeNames })
    }
  }
  return out
}

/** Negocios vacíos (sin lugares) donde el usuario es el único miembro: se borran con la cuenta. */
export function emptyBusinessesRemoved(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.placeNames.length === 0 && m.otherMembers === 0)
}

export type DeletionRequest = {
  /** Usuario de la sesión (cookies). Es el ÚNICO id que se borra: nunca viene del formulario. */
  sessionUserId: string | null
  /** Usuario que devolvió la re-autenticación con contraseña (null si falló). */
  reauthUserId: string | null
  confirmation: unknown
  isAdmin: boolean
  memberships: Membership[]
}

export type DeletionRefusal = 'no_session' | 'bad_confirmation' | 'reauth_failed' | 'identity_mismatch' | 'blocked'
export type DeletionDecision =
  | { ok: true; userId: string }
  | { ok: false; reason: Exclude<DeletionRefusal, 'blocked'> }
  | { ok: false; reason: 'blocked'; blockers: DeletionBlocker[] }

/**
 * Todas las condiciones, en orden. Solo `ok: true` autoriza a borrar, y el id que devuelve es
 * siempre el de la sesión, confirmado además por la contraseña.
 */
export function decideDeletion(req: DeletionRequest): DeletionDecision {
  if (!req.sessionUserId) return { ok: false, reason: 'no_session' }
  if (!confirmationMatches(req.confirmation)) return { ok: false, reason: 'bad_confirmation' }
  if (!req.reauthUserId) return { ok: false, reason: 'reauth_failed' }
  // La contraseña debe ser la de ESTA cuenta, no la de otra.
  if (req.reauthUserId !== req.sessionUserId) return { ok: false, reason: 'identity_mismatch' }
  const blockers = deletionBlockers(req)
  if (blockers.length) return { ok: false, reason: 'blocked', blockers }
  return { ok: true, userId: req.sessionUserId }
}

const list = (names: string[]) =>
  names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} y ${names.length - 3} más`

/** Texto para la persona de cada bloqueo. */
export function blockerMessage(b: DeletionBlocker): string {
  if (b.code === 'admin') return 'Las cuentas de administración no se eliminan desde aquí.'
  const one = b.placeNames.length === 1
  return `Eres el único dueño de ${b.businessName} (${list(b.placeNames)}). Antes de eliminar tu cuenta escríbenos para liberar ${one ? 'el lugar' : 'los lugares'}: ${one ? 'volverá' : 'volverán'} a quedar sin reclamar y se quitarán sus eventos y promociones.`
}

export const DELETION_MESSAGES: Record<DeletionRefusal, string> = {
  no_session: 'Inicia sesión para continuar.',
  bad_confirmation: `Escribe ${DELETE_CONFIRM_PHRASE} para confirmar.`,
  reauth_failed: 'La contraseña no es correcta.',
  identity_mismatch: 'La contraseña no es correcta.',
  blocked: 'Tu cuenta no se puede eliminar todavía.',
}

/** Errores de la función SQL (última guarda) traducidos a un motivo conocido. */
export function dbBlockReason(message: string | null | undefined): 'admin' | 'last_owner' | null {
  if (!message) return null
  if (message.includes('account_delete_blocked_admin')) return 'admin'
  if (message.includes('account_delete_blocked_business')) return 'last_owner'
  return null
}
