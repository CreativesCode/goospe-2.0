// Utilidades compartidas del ETL: carga de .env.local, cliente service-role y pool de concurrencia.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

export function loadEnv() {
  const txt = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

export function makeServiceClient(env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// Ejecuta fn sobre items con N workers concurrentes. Los errores no abortan el lote:
// se devuelven como { __error } en su posición.
export async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++
        try {
          out[idx] = await fn(items[idx], idx)
        } catch (e) {
          out[idx] = { __error: e.message }
        }
      }
    })
  )
  return out
}
