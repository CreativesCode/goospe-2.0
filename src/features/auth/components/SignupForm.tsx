'use client'

import { useState } from 'react'
import { signup } from '@/actions/auth'

const input =
  'mt-1 block w-full rounded-lg border border-black/10 px-4 py-2.5 text-goospe-gray outline-none focus:ring-2 focus:ring-goospe-green'

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
        <label htmlFor="display_name" className="block text-sm font-medium text-goospe-gray">Nombre</label>
        <input id="display_name" name="display_name" type="text" className={input} placeholder="Cómo te llamas" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-goospe-gray">Email</label>
        <input id="email" name="email" type="email" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-goospe-gray">Contraseña</label>
        <input id="password" name="password" type="password" required minLength={6} className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-goospe-green py-2.5 font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-60"
      >
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
