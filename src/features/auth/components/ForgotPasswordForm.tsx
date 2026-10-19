'use client'

import { useState } from 'react'
import { resetPassword } from '@/actions/auth'
import { fieldClass, primaryBtn } from '@/shared/lib/ui'

/** `notice`: aviso inicial (p. ej. "tu enlace expiró") que llega desde la página. */
export function ForgotPasswordForm({ notice = null }: { notice?: string | null }) {
  const [error, setError] = useState<string | null>(notice)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(formData: FormData) {
    setLoading(true); setError(null)
    const result = await resetPassword(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  if (success) {
    return <p role="status" className="rounded-[14px] bg-tint px-4 py-3 text-ink">Revisa tu correo para el enlace de recuperación.</p>
  }

  return (
    <form action={handle} className="space-y-3.5">
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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={`${primaryBtn} !mt-5`}>
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  )
}
