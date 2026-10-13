'use client'

import { useState } from 'react'
import Link from 'next/link'
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
        <input id="display_name" name="display_name" type="text" autoComplete="name" className={fieldClass} placeholder="Cómo te llamas" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          className={fieldClass}
        />
      </div>
      <PasswordField required minLength={6} autoComplete="new-password" />
      <label className="flex items-start gap-2.5 text-sm text-fg-soft">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-goospe-green" />
        <span>
          Acepto los{' '}
          <Link href="/terms" target="_blank" className="text-goospe-green hover:underline">Términos y Condiciones</Link> y la{' '}
          <Link href="/privacy" target="_blank" className="text-goospe-green hover:underline">Política de privacidad</Link>.
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
