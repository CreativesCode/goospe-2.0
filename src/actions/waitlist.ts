'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Insert público en waitlist (RLS lo permite); validamos aquí con Zod.
const schema = z.object({
  email: z.email(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  detectedLabel: z.string().max(120).optional(),
})

export type WaitlistResult = { success: true } | { error: string }

export async function joinWaitlist(input: unknown): Promise<WaitlistResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Ingresa un correo válido.' }

  const { email, lat, lng, detectedLabel } = parsed.data
  const sb = await createClient()
  const { error } = await sb.from('waitlist').insert({
    email,
    lat: lat ?? null,
    lng: lng ?? null,
    detected_label: detectedLabel ?? null,
  } as never)

  if (error) return { error: 'No pudimos guardarte ahora. Intenta de nuevo.' }
  return { success: true }
}
