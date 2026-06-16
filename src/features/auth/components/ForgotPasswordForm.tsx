'use client'

import { useState } from 'react'
import { resetPassword } from '@/actions/auth'

const input =
  'mt-1 block w-full rounded-lg border border-black/10 px-4 py-2.5 text-goospe-gray outline-none focus:ring-2 focus:ring-goospe-green'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(formData: FormData) {
    setLoading(true); setError(null)
    const result = await resetPassword(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  if (success) return <p className="text-center text-goospe-green-dark">Revisa tu correo para el enlace de recuperación.</p>

  return (
    <form action={handle} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-goospe-gray">Email</label>
        <input id="email" name="email" type="email" required className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-goospe-green py-2.5 font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  )
}
