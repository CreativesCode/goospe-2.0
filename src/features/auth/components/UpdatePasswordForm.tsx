'use client'

import { useState } from 'react'
import { updatePassword } from '@/actions/auth'
import { primaryBtn } from '@/shared/lib/ui'
import { PasswordField } from './PasswordField'

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handle(formData: FormData) {
    setLoading(true); setError(null)
    const result = await updatePassword(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form action={handle} className="space-y-4">
      <PasswordField label="Nueva contraseña" required minLength={6} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}
