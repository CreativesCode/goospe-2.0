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

// El dueño sube una foto de su carta → gpt-4o visión la estructura → se guarda en places.menu.
export async function uploadMenu(formData: FormData) {
  const placeId = formData.get('place_id') as string
  const file = formData.get('file') as File | null

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const businessId = await assertPlaceMembership(user.id, placeId)
  if (!businessId) return { error: 'Sin permiso' }
  if (!file || file.size === 0) return { error: 'Selecciona una imagen de la carta' }
  if (!OK_TYPES.includes(file.type)) return { error: 'Usa JPG, PNG o WebP' }
  if (file.size > MAX_BYTES) return { error: 'La imagen supera los 8 MB' }

  const admin = createAdminClient()
  const path = `menus/${placeId}/${randomUUID()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from('places').upload(path, buffer, { contentType: file.type })
  if (upErr) return { error: upErr.message }
  const { data: pub } = admin.storage.from('places').getPublicUrl(path)

  try {
    const { data, usage } = await visionJson(pub.publicUrl, SYSTEM, 'Extrae la carta de esta imagen.', MENU_SCHEMA)
    await admin.from('places').update({ menu: data, menu_updated_at: new Date().toISOString() } as never).eq('id', placeId)
    void admin.from('ai_usage').insert({
      feature: 'menu_vision', model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
      cost_usd: COST(usage), user_id: user.id, business_id: businessId,
    } as never)
    await admin.storage.from('places').remove([path]) // la imagen era sólo para el OCR
    const sections = (data as { sections?: unknown[] }).sections ?? []
    revalidatePath(`/panel/${placeId}`)
    return { success: true, count: sections.length }
  } catch (e) {
    await admin.storage.from('places').remove([path])
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
