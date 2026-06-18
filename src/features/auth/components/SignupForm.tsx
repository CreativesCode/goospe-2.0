'use client'

import { useState } from 'react'
import { signup } from '@/actions/auth'
import { fieldClass, primaryBtn } from '@/shared/lib/ui'
import { PasswordField } from './PasswordField'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handle(formData: FormData) {
    setLoading(true); setError(null)
    const result = await signup(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form action={handle} className="space-y-4">
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-fg">Nombre</label>
        <input id="display_name" name="display_name" type="text" className={fieldClass} placeholder="Cómo te llamas" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg">Email</label>
        <input id="email" name="email" type="email" required className={fieldClass} />
      </div>
      <PasswordField required minLength={6} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
