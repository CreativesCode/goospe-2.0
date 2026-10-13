import { describe, expect, it } from 'vitest'
import {
  DELETE_CONFIRM_PHRASE, blockerMessage, confirmationMatches, dbBlockReason, decideDeletion,
  deletionBlockers, emptyBusinessesRemoved, type DeletionRequest, type Membership,
} from '@/features/profile/account-deletion'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

const membership = (over: Partial<Membership> = {}): Membership => ({
  businessId: 'b1', businessName: 'Café del Lago', role: 'owner', placeNames: ['Café del Lago'],
  otherOwners: 0, otherMembers: 0, ...over,
})

const request = (over: Partial<DeletionRequest> = {}): DeletionRequest => ({
  sessionUserId: ME, reauthUserId: ME, confirmation: DELETE_CONFIRM_PHRASE, isAdmin: false, memberships: [], ...over,
})

describe('confirmationMatches', () => {
  it.each(['ELIMINAR', 'eliminar', '  Eliminar  '])('acepta %j', (v) => {
    expect(confirmationMatches(v)).toBe(true)
  })
  it.each(['', 'ELIMINA', 'ELIMINAR CUENTA', 'borrar', 'E L I M I N A R', null, undefined, 1, {}])('rechaza %j', (v) => {
    expect(confirmationMatches(v)).toBe(false)
  })
})

describe('decideDeletion', () => {
  it('autoriza solo con sesión, confirmación y contraseña de la misma cuenta', () => {
    expect(decideDeletion(request())).toEqual({ ok: true, userId: ME })
  })

  it('el id autorizado es siempre el de la sesión', () => {
    const d = decideDeletion(request())
    expect(d.ok && d.userId).toBe(ME)
  })

  it('sin sesión no hay nada que borrar', () => {
    expect(decideDeletion(request({ sessionUserId: null }))).toEqual({ ok: false, reason: 'no_session' })
    expect(decideDeletion(request({ sessionUserId: '' }))).toEqual({ ok: false, reason: 'no_session' })
  })

  it('sin la palabra de confirmación se rechaza aunque la contraseña sea correcta', () => {
    expect(decideDeletion(request({ confirmation: 'si' }))).toEqual({ ok: false, reason: 'bad_confirmation' })
    expect(decideDeletion(request({ confirmation: null }))).toEqual({ ok: false, reason: 'bad_confirmation' })
  })

  it('contraseña incorrecta: no se borra', () => {
    expect(decideDeletion(request({ reauthUserId: null }))).toEqual({ ok: false, reason: 'reauth_failed' })
  })

  it('la contraseña de OTRA cuenta no sirve para borrar esta', () => {
    expect(decideDeletion(request({ reauthUserId: OTHER }))).toEqual({ ok: false, reason: 'identity_mismatch' })
  })

  it('una sesión ajena con mi contraseña tampoco me borra a mí', () => {
    const d = decideDeletion(request({ sessionUserId: OTHER, reauthUserId: ME }))
    expect(d).toEqual({ ok: false, reason: 'identity_mismatch' })
  })

  it('una cuenta admin queda bloqueada', () => {
    const d = decideDeletion(request({ isAdmin: true }))
    expect(d).toEqual({ ok: false, reason: 'blocked', blockers: [{ code: 'admin' }] })
  })

  it('el último dueño de un negocio con lugares queda bloqueado', () => {
    const d = decideDeletion(request({ memberships: [membership()] }))
    expect(d.ok).toBe(false)
    expect(d).toMatchObject({ reason: 'blocked', blockers: [{ code: 'last_owner', businessId: 'b1' }] })
  })

  it('los bloqueos no se saltan sin confirmación ni contraseña: esas se evalúan antes', () => {
    const blocked = { isAdmin: true, memberships: [membership()] }
    expect(decideDeletion(request({ ...blocked, confirmation: '' }))).toEqual({ ok: false, reason: 'bad_confirmation' })
    expect(decideDeletion(request({ ...blocked, reauthUserId: null }))).toEqual({ ok: false, reason: 'reauth_failed' })
  })

  it('ninguna combinación con un dato faltante autoriza', () => {
    const variants: Partial<DeletionRequest>[] = [
      { sessionUserId: null }, { reauthUserId: null }, { reauthUserId: OTHER }, { confirmation: '' },
      { isAdmin: true }, { memberships: [membership()] },
    ]
    for (const v of variants) expect(decideDeletion(request(v)).ok).toBe(false)
  })
})

describe('deletionBlockers', () => {
  it('sin negocios no hay bloqueo', () => {
    expect(deletionBlockers({ isAdmin: false, memberships: [] })).toEqual([])
  })

  it('con otro dueño en el negocio se puede salir', () => {
    expect(deletionBlockers({ isAdmin: false, memberships: [membership({ otherOwners: 1, otherMembers: 1 })] })).toEqual([])
  })

  it('otros miembros que no son dueños no bastan', () => {
    const b = deletionBlockers({ isAdmin: false, memberships: [membership({ otherOwners: 0, otherMembers: 2 })] })
    expect(b).toHaveLength(1)
  })

  it('un negocio sin lugares no bloquea', () => {
    expect(deletionBlockers({ isAdmin: false, memberships: [membership({ placeNames: [] })] })).toEqual([])
  })

  it('lista cada negocio que bloquea', () => {
    const b = deletionBlockers({
      isAdmin: false,
      memberships: [membership(), membership({ businessId: 'b2', businessName: 'Bar Sur', placeNames: ['Bar Sur', 'Bar Sur Playa'] }), membership({ businessId: 'b3', otherOwners: 1 })],
    })
    expect(b.map((x) => (x.code === 'last_owner' ? x.businessId : x.code))).toEqual(['b1', 'b2'])
  })
})

describe('emptyBusinessesRemoved', () => {
  it('solo los negocios sin lugares y sin más miembros', () => {
    const list = [
      membership({ businessId: 'vacio', placeNames: [] }),
      membership({ businessId: 'con-lugar' }),
      membership({ businessId: 'compartido', placeNames: [], otherMembers: 1 }),
    ]
    expect(emptyBusinessesRemoved(list).map((m) => m.businessId)).toEqual(['vacio'])
  })
})

describe('mensajes', () => {
  it('explica qué pasa con los lugares del último dueño', () => {
    const text = blockerMessage({ code: 'last_owner', businessId: 'b1', businessName: 'Café del Lago', placeNames: ['Café del Lago'] })
    expect(text).toContain('Café del Lago')
    expect(text).toContain('sin reclamar')
  })

  it('resume una lista larga de lugares', () => {
    const text = blockerMessage({ code: 'last_owner', businessId: 'b1', businessName: 'Grupo', placeNames: ['A', 'B', 'C', 'D', 'E'] })
    expect(text).toContain('A, B, C y 2 más')
  })

  it('reconoce las guardas de la función SQL', () => {
    expect(dbBlockReason('account_delete_blocked_admin')).toBe('admin')
    expect(dbBlockReason('ERROR: account_delete_blocked_business')).toBe('last_owner')
    expect(dbBlockReason('permission denied')).toBeNull()
    expect(dbBlockReason(null)).toBeNull()
  })
})
