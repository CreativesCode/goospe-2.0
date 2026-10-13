import { describe, expect, it } from 'vitest'
import {
  changeEmailSchema, changePasswordSchema, deleteAccountSchema, latestBirthYear, profileSchema,
} from '@/features/profile/profile-schema'
import { TERMS_VERSION, termsAccepted } from '@/features/profile/terms'
import { correctionSchema, generalFeedbackSchema, resolveFeedbackSchema, categoryLabel } from '@/features/feedback/feedback-schema'
import {
  normalizeMuted, pageRange, savedEventDedupeKey, toggleMuted, totalPages,
} from '@/features/notifications/kinds'

const NOW = new Date('2026-10-12T12:00:00Z')
const PLACE = '11111111-1111-4111-8111-111111111111'

describe('profileSchema', () => {
  const parse = (v: Record<string, unknown>) => profileSchema(NOW).safeParse({ display_name: 'Ana', home_city_id: '', birth_year: '', ...v })

  it('acepta el mínimo y deja en null lo vacío', () => {
    const r = parse({})
    expect(r.success && r.data).toEqual({ display_name: 'Ana', home_city_id: null, birth_year: null })
  })

  it('recorta y colapsa espacios del nombre', () => {
    const r = parse({ display_name: '  Ana   María  ' })
    expect(r.success && r.data.display_name).toBe('Ana María')
  })

  it.each(['', 'A', 'x'.repeat(61), 'Ana <b>', 'puta madre'])('rechaza el nombre %j', (display_name) => {
    expect(parse({ display_name }).success).toBe(false)
  })

  it('convierte ciudad y año a número', () => {
    const r = parse({ home_city_id: '3', birth_year: '1990' })
    expect(r.success && r.data).toMatchObject({ home_city_id: 3, birth_year: 1990 })
  })

  it.each(['abc', '0', '-1', '1.5'])('rechaza la ciudad %j', (home_city_id) => {
    expect(parse({ home_city_id }).success).toBe(false)
  })

  it('exige edad mínima y un año razonable', () => {
    expect(latestBirthYear(NOW)).toBe(2013)
    expect(parse({ birth_year: '2013' }).success).toBe(true)
    expect(parse({ birth_year: '2014' }).success).toBe(false)
    expect(parse({ birth_year: '1899' }).success).toBe(false)
    expect(parse({ birth_year: 'mil' }).success).toBe(false)
  })

  it('no deja pasar campos que el usuario no puede escribir', () => {
    const r = parse({ is_admin: true, onboarding: {}, terms_accepted_at: 'x' })
    expect(r.success && Object.keys(r.data).sort()).toEqual(['birth_year', 'display_name', 'home_city_id'])
  })
})

describe('cuenta', () => {
  it('cambiar contraseña: la nueva debe cumplir la política y ser distinta', () => {
    expect(changePasswordSchema.safeParse({ current_password: 'vieja1', new_password: 'nueva123' }).success).toBe(true)
    expect(changePasswordSchema.safeParse({ current_password: 'vieja1', new_password: '123' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ current_password: 'igual123', new_password: 'igual123' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ current_password: '', new_password: 'nueva123' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ current_password: null, new_password: null }).success).toBe(false)
  })

  it('cambiar email: normaliza y valida', () => {
    const r = changeEmailSchema.safeParse({ current_password: 'x', email: '  Ana@Example.COM ' })
    expect(r.success && r.data.email).toBe('ana@example.com')
    expect(changeEmailSchema.safeParse({ current_password: 'x', email: 'ana@' }).success).toBe(false)
    expect(changeEmailSchema.safeParse({ current_password: '', email: 'ana@example.com' }).success).toBe(false)
  })

  it('eliminar cuenta: exige contraseña', () => {
    expect(deleteAccountSchema.safeParse({ current_password: '', confirmation: 'ELIMINAR' }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ current_password: 'x', confirmation: 'ELIMINAR' }).success).toBe(true)
  })

  it('términos: solo una casilla marcada cuenta como aceptación', () => {
    expect(termsAccepted('on')).toBe(true)
    for (const v of [null, undefined, '', 'off', 'false', 0]) expect(termsAccepted(v)).toBe(false)
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(TERMS_VERSION.length).toBeLessThanOrEqual(20) // CHECK de profiles.terms_version
  })
})

describe('feedback', () => {
  const general = (v: Record<string, unknown>) =>
    generalFeedbackSchema.safeParse({ kind: 'general', category: 'bug', message: 'El mapa no carga en mi teléfono', contact_email: '', page: '/feed', ...v })

  it('acepta un mensaje normal', () => {
    const r = general({})
    expect(r.success && r.data).toMatchObject({ category: 'bug', contact_email: null, page: '/feed' })
  })

  it.each([
    ['categoría desconocida', { category: 'spam' }],
    ['mensaje corto', { message: 'hola' }],
    ['mensaje enorme', { message: 'x'.repeat(1001) }],
    ['grosería', { message: 'esta app es una mierda total' }],
    ['email inválido', { contact_email: 'no-es-email' }],
  ])('rechaza: %s', (_n, v) => {
    expect(general(v).success).toBe(false)
  })

  it.each(['https://evil.com', '//evil.com', 'javascript:alert(1)', '/a\\b', 42])('descarta una página que no es ruta interna: %j', (page) => {
    const r = general({ page })
    expect(r.success && r.data.page).toBeNull()
  })

  const correction = (v: Record<string, unknown>) =>
    correctionSchema.safeParse({ kind: 'correction', place_id: PLACE, category: 'hours', message: '', page: null, ...v })

  it('corrección de horario sin nota es válida', () => {
    const r = correction({})
    expect(r.success && r.data.message).toBeNull()
  })

  it('"cerró" y "pin mal" tampoco exigen nota', () => {
    expect(correction({ category: 'closed' }).success).toBe(true)
    expect(correction({ category: 'location' }).success).toBe(true)
  })

  it.each(['duplicate', 'info', 'other'])('%s exige explicación', (category) => {
    expect(correction({ category }).success).toBe(false)
    expect(correction({ category, message: 'ok' }).success).toBe(false)
    expect(correction({ category, message: 'Es el mismo que Café Sur' }).success).toBe(true)
  })

  it('exige un lugar válido', () => {
    expect(correction({ place_id: 'x' }).success).toBe(false)
    expect(correction({ place_id: null }).success).toBe(false)
  })

  it('resolución del admin', () => {
    expect(resolveFeedbackSchema.safeParse({ feedback_id: PLACE, decision: 'resolved', note: '' }).success).toBe(true)
    expect(resolveFeedbackSchema.safeParse({ feedback_id: PLACE, decision: 'open', note: '' }).success).toBe(false)
    expect(resolveFeedbackSchema.safeParse({ feedback_id: PLACE, decision: 'dismissed', note: 'x'.repeat(501) }).success).toBe(false)
  })

  it('etiquetas por tipo', () => {
    expect(categoryLabel('correction', 'closed')).toBe('Cerró definitivamente')
    expect(categoryLabel('general', 'idea')).toBe('Tengo una idea')
    expect(categoryLabel('general', 'desconocida')).toBe('desconocida')
  })
})

describe('notificaciones', () => {
  it('la clave del aviso de lugar guardado agrupa por lugar y día (UTC)', () => {
    const a = savedEventDedupeKey(PLACE, new Date('2026-10-12T01:00:00Z'))
    const b = savedEventDedupeKey(PLACE, new Date('2026-10-12T23:59:59Z'))
    const c = savedEventDedupeKey(PLACE, new Date('2026-10-13T00:00:00Z'))
    expect(a).toBe(`saved_event:${PLACE}:2026-10-12`)
    expect(b).toBe(a) // mismo día: mismo aviso (tope de uno por lugar y día)
    expect(c).not.toBe(a)
    expect(savedEventDedupeKey('otro', new Date('2026-10-12T01:00:00Z'))).not.toBe(a)
  })

  it('silenciados: solo grupos conocidos', () => {
    expect(normalizeMuted(['saved_places', 'x', 'saved_places'])).toEqual(['saved_places'])
    expect(normalizeMuted(null)).toEqual([])
    expect(normalizeMuted('saved_places')).toEqual([])
    expect(toggleMuted([], 'saved_places', true)).toEqual(['saved_places'])
    expect(toggleMuted(['saved_places'], 'saved_places', true)).toEqual(['saved_places'])
    expect(toggleMuted(['saved_places'], 'saved_places', false)).toEqual([])
  })

  it('paginación del historial', () => {
    expect(pageRange(undefined)).toEqual({ page: 1, from: 0, to: 19 })
    expect(pageRange('3')).toEqual({ page: 3, from: 40, to: 59 })
    for (const bad of ['0', '-2', 'abc', '1.5', '99999', ['2']]) expect(pageRange(bad).page).toBe(1)
    expect(pageRange('9999').page).toBe(500)
    expect(totalPages(0)).toBe(1)
    expect(totalPages(null)).toBe(1)
    expect(totalPages(20)).toBe(1)
    expect(totalPages(21)).toBe(2)
  })
})
