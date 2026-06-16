'use client'

import { useState } from 'react'
import { updatePassword } from '@/actions/auth'

const input =
  'mt-1 block w-full rounded-lg border border-black/10 px-4 py-2.5 text-goospe-gray outline-none focus:ring-2 focus:ring-goospe-green'

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
        <label htmlFor="password" className="block text-sm font-medium text-goospe-gray">Nueva contraseña</label>
        <input id="password" name="password" type="password" required minLength={6} className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-goospe-green py-2.5 font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-60"
      >
        {loading ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}
