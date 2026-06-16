import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Cliente Supabase con service_role. SOLO servidor (route handlers, server components, ETL).
// NUNCA lo importes en un componente cliente: la service_role key bypassa RLS.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
