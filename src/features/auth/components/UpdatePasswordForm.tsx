'use client'

import { useState } from 'react'
import { updatePassword } from '@/actions/auth'
import { fieldClass, primaryBtn } from '@/shared/lib/ui'

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
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg">Nueva contraseña</label>
        <input id="password" name="password" type="password" required minLength={6} className={fieldClass} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}
