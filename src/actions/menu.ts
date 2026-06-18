'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPlaceMembership } from '@/lib/ownership'
import { visionJson, type Usage } from '@/lib/ai/openai'

const MAX_BYTES = 8 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const COST = (u: Usage) => (u.input_tokens / 1e6) * 2.5 + (u.output_tokens / 1e6) * 10

const MENU_SCHEMA = {
  name: 'menu', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  price: { type: ['string', 'null'] },
                  description: { type: ['string', 'null'] },
                },
                required: ['name', 'price', 'description'],
              },
            },
          },
          required: ['name', 'items'],
        },
      },
    },
    required: ['sections'],
  },
}

const SYSTEM = `Eres un OCR estructurador de cartas de restaurante. Devuelves SOLO lo que ves en la
imagen: secciones y platos con su precio tal cual aparece (string, ej "$8.900") y una descripción
breve si la hay. No inventes platos ni precios. Si algo no se lee, omítelo.`

type MenuItem = { name: string; price: string | null; description: string | null }
type MenuSection = { name: string; items: MenuItem[] }

const MAX_FILES = 6

// Fusiona secciones nuevas sobre una base: por nombre (case-insensitive) anexa platos;
// si la sección no existe, la agrega al final.
function mergeSections(base: MenuSection[], add: MenuSection[]): MenuSection[] {
  const out: MenuSection[] = base.map((s) => ({ name: s.name, items: [...(s.items ?? [])] }))
  for (const s of add) {
    const key = s.name.trim().toLowerCase()
    const existing = out.find((o) => o.name.trim().toLowerCase() === key)
    if (existing) existing.items.push(...(s.items ?? []))
    else out.push({ name: s.name, items: s.items ?? [] })
  }
  return out
}

// El dueño sube una o varias fotos de su carta → gpt-4o visión las estructura → places.menu.
// `mode=append` fusiona con la carta existente (agregar páginas); `replace` la sustituye.
export async function uploadMenu(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const mode = (formData.get('mode') as string) === 'append' ? 'append' : 'replace'
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }
  if (files.length === 0) return { error: 'Selecciona al menos una imagen de la carta' }
  if (files.length > MAX_FILES) return { error: `Máximo ${MAX_FILES} imágenes por vez` }
  for (const f of files) {
    if (!OK_TYPES.includes(f.type)) return { error: 'Usa JPG, PNG o WebP' }
    if (f.size > MAX_BYTES) return { error: 'Alguna imagen supera los 8 MB' }
  }

  const admin = createAdminClient()

  // Base: carta existente si es append; vacío si es replace.
  let merged: MenuSection[] = []
  if (mode === 'append') {
    const { data: row } = await admin.from('places').select('menu').eq('id', placeId).single()
    merged = (((row as { menu?: { sections?: MenuSection[] } } | null)?.menu?.sections) ?? []) as MenuSection[]
  }

  const uploaded: string[] = []
  try {
    for (const file of files) {
      const path = `menus/${placeId}/${randomUUID()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await admin.storage.from('places').upload(path, buffer, { contentType: file.type })
      if (upErr) throw new Error(upErr.message)
      uploaded.push(path)
      const { data: pub } = admin.storage.from('places').getPublicUrl(path)

      const { data, usage } = await visionJson(pub.publicUrl, SYSTEM, 'Extrae la carta de esta imagen.', MENU_SCHEMA)
      merged = mergeSections(merged, (data as { sections?: MenuSection[] }).sections ?? [])
      void admin.from('ai_usage').insert({
        feature: 'menu_vision', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
        input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
        cost_usd: COST(usage), user_id: user.id, business_id: businessId,
      } as never)
    }

    await admin
      .from('places')
      .update({ menu: { sections: merged }, menu_updated_at: new Date().toISOString() } as never)
      .eq('id', placeId)
    await admin.storage.from('places').remove(uploaded) // las imágenes eran sólo para el OCR
    revalidatePath(`/panel/${placeId}`)
    return { success: true, count: merged.length }
  } catch (e) {
    if (uploaded.length) await admin.storage.from('places').remove(uploaded)
    return { error: (e as Error).message }
  }
}

export async function clearMenu(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (!(await assertPlaceMembership(user.id, placeId))) return { error: 'Sin permiso' }
  const admin = createAdminClient()
  await admin.from('places').update({ menu: null, menu_updated_at: null } as never).eq('id', placeId)
  revalidatePath(`/panel/${placeId}`)
  return { success: true }
}
