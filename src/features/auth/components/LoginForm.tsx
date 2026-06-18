'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { fieldClass, primaryBtn } from '@/shared/lib/ui'
import { PasswordField } from './PasswordField'

export function LoginForm() {
  const next = useSearchParams().get('next') ?? '/feed'
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handle(formData: FormData) {
    setLoading(true); setError(null)
    const result = await login(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form action={handle} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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
      <PasswordField required autoComplete="current-password" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-center text-sm text-fg-soft">
        <Link href="/forgot-password" className="text-goospe-green hover:underline">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  )
}
