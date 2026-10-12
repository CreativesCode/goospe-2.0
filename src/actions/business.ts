'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { revalidatePlace } from '@/lib/revalidate-place'
import { rateLimit } from '@/lib/rate-limit'
import { requireOwner } from '@/lib/owner-guard'
import { audit } from '@/lib/audit'
import { diffFields } from '@/lib/audit-diff'
import { notifyAdmins } from '@/lib/notify'
import { toStoredHours } from '@/lib/hours-editor'
import type { Json } from '@/lib/database.types'
import { claimSchema, firstIssue } from '@/features/business/listing-schema'
import { buildAddress, ownerListingSchema, type PlaceAddress } from '@/features/business/owner-schemas'

// Las escrituras a places/businesses sólo las permite service_role (ver 0004_rls).
// Por eso usamos el admin client, pero SIEMPRE validando en código la identidad y la
// membresía del usuario contra su sesión real.

async function requireUser() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/panel')
  return user
}

// Solicitud de reclamo (moderada): el usuario pide administrar un lugar y el reclamo queda
// PENDIENTE con sus datos de contacto en `evidence`. Un admin lo revisa personalmente en
// /admin/claims (aprobar/rechazar). NO se otorga la propiedad hasta la aprobación.
export async function claimPlace(formData: FormData) {
  const placeId = formData.get('place_id')
  if (!isUuid(placeId)) redirect('/panel/claim?error=Falta+el+lugar')
  const user = await requireUser()

  // Datos de contacto validados antes de tocar la base (el error vuelve por ?error= como el resto).
  const contact = claimSchema.safeParse({
    contact_name: formData.get('contact_name'),
    phone: formData.get('phone'),
    message: formData.get('message'),
  })
  if (!contact.success) redirect(`/panel/claim?error=${encodeURIComponent(firstIssue(contact.error))}`)

  // Cada reclamo avisa al equipo: tope para que nadie inunde la bandeja.
  if (!(await rateLimit(`claim:${user.id}`, 3600, 10))) redirect('/panel/claim?error=Enviaste+muchas+solicitudes.+Intenta+de+nuevo+en+un+rato')

  const admin = createAdminClient()

  const { data: place } = await admin
    .from('places')
    .select('id, name, claimed, business_id')
    .eq('id', placeId)
    .single()
  const p = place as { id: string; name: string; claimed: boolean; business_id: string | null } | null
  if (!p) redirect('/panel/claim?error=Lugar+no+encontrado')
  if (p!.claimed || p!.business_id) redirect('/panel/claim?error=Este+lugar+ya+fue+reclamado')

  // Evita solicitudes duplicadas del mismo usuario para el mismo lugar.
  const { data: existing } = await admin
    .from('claims')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) redirect('/panel/claim?sent=1')

  // Datos de contacto para que el admin verifique de forma personal.
  const evidence = {
    contact_name: contact.data.contact_name,
    phone: contact.data.phone,
    email: user.email ?? null,
    message: contact.data.message,
  }

  const { error: insErr } = await admin
    .from('claims')
    .insert({ place_id: placeId, user_id: user.id, method: 'manual', status: 'pending', evidence })
  if (insErr) {
    console.error('[claimPlace]', insErr.message)
    // 23505: ya hay una solicitud pendiente suya para este lugar (índice único de 0037).
    redirect(insErr.code === '23505' ? '/panel/claim?sent=1' : '/panel/claim?error=No+pudimos+enviar+la+solicitud')
  }

  // Aviso al equipo: hay un reclamo nuevo por revisar.
  await notifyAdmins({
    kind: 'claim_new',
    title: `Nuevo reclamo: ${p!.name}`,
    body: contact.data.contact_name ? `Lo solicita ${contact.data.contact_name}` : null,
    link: '/admin/claims',
    placeId,
  })

  revalidatePath('/admin/claims')
  redirect('/panel/claim?sent=1')
}

const LISTING_COLS = 'slug, description, vibe_line, phone, whatsapp, website, instagram, email, price_level, tags, address, hours'
const LISTING_FIELDS = [
  'description', 'vibe_line', 'phone', 'whatsapp', 'website', 'instagram', 'email',
  'price_level', 'tags', 'street', 'street_number', 'category_ids', 'hours',
] as const
const SAVE_FAILED = 'No pudimos guardar. Intenta de nuevo.'

type AdminClient = ReturnType<typeof createAdminClient>

// Reemplaza las categorías del lugar si cambiaron. Solo admite categorías existentes y activas.
async function saveCategories(admin: AdminClient, placeId: string, ids: number[]) {
  const [{ data: valid }, { data: current }] = await Promise.all([
    admin.from('categories').select('id').in('id', ids).eq('enabled', true),
    admin.from('place_categories').select('category_id').eq('place_id', placeId),
  ])
  if ((valid ?? []).length !== ids.length) return { error: 'Categoría inválida' }
  const before = ((current ?? []) as { category_id: number }[]).map((c) => c.category_id).sort()
  const after = [...ids].sort()
  if (JSON.stringify(before) === JSON.stringify(after)) return { before, after }

  // Primero se insertan las nuevas y después se quitan las que sobran: nunca queda sin categoría.
  const toAdd = after.filter((id) => !before.includes(id))
  const toDrop = before.filter((id) => !after.includes(id))
  if (toAdd.length) {
    const { error } = await admin.from('place_categories').insert(toAdd.map((category_id) => ({ place_id: placeId, category_id })))
    if (error) return { error: SAVE_FAILED, detail: error.message }
  }
  if (toDrop.length) {
    const { error } = await admin.from('place_categories').delete().eq('place_id', placeId).in('category_id', toDrop)
    if (error) return { error: SAVE_FAILED, detail: error.message }
  }
  return { before, after }
}

// Edita la ficha del place: textos, contacto, dirección, categorías y horario. El NOMBRE y la
// UBICACIÓN en el mapa no se cambian aquí (solicitud al admin, ver actions/owner-requests.ts).
export async function updateListing(formData: FormData) {
  const ctx = await requireOwner(formData.get('place_id'))
  if ('error' in ctx) return { error: ctx.error }
  const { placeId, user } = ctx

  const parsed = ownerListingSchema.safeParse(Object.fromEntries(LISTING_FIELDS.map((k) => [k, formData.get(k)])))
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (!(await rateLimit(`listing:${user.id}`, 600, 30))) return { error: 'Vas muy rápido. Intenta de nuevo en unos minutos.' }

  const admin = createAdminClient()
  const { data: beforeRow } = await admin.from('places').select(LISTING_COLS).eq('id', placeId).maybeSingle()
  const before = beforeRow as (Record<string, unknown> & { slug: string; address: PlaceAddress | null }) | null
  if (!before) return { error: 'Lugar no encontrado' }

  const { street, street_number, category_ids, hours, ...fields } = parsed.data
  const patch = {
    ...fields,
    address: buildAddress(before.address, street, street_number) as Json,
    // Sin `hours` en el formulario no se toca el horario guardado.
    ...(hours ? { hours: toStoredHours(hours) as Json } : {}),
  }

  const { error } = await admin.from('places').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', placeId)
  if (error) {
    // Nunca devolver el mensaje de Postgres al cliente.
    console.error('[updateListing]', error.message)
    return { error: SAVE_FAILED }
  }

  const cats = await saveCategories(admin, placeId, category_ids)
  if ('error' in cats) {
    console.error('[updateListing] categorías:', cats.detail ?? cats.error)
    return { error: cats.error }
  }

  const changes = diffFields({ ...before, category_ids: cats.before }, { ...patch, category_ids: cats.after })
  if (Object.keys(changes).length) {
    await audit({ userId: user.id, action: 'owner.listing_update', objectType: 'place', objectId: placeId, payload: { changes } })
  }

  revalidatePath(`/panel/${placeId}`)
  revalidatePath('/panel')
  // La ficha pública es ISR de 1 h: sin esto el cambio del dueño tardaba hasta una hora en verse.
  await revalidatePlace(placeId, before.slug)
  return { success: true }
}
