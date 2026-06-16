'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/actions/auth'

const input =
  'mt-1 block w-full rounded-lg border border-black/10 px-4 py-2.5 text-goospe-gray outline-none focus:ring-2 focus:ring-goospe-green'

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
        <label htmlFor="email" className="block text-sm font-medium text-goospe-gray">Email</label>
        <input id="email" name="email" type="email" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-goospe-gray">Contraseña</label>
        <input id="password" name="password" type="password" required className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-goospe-green py-2.5 font-medium text-white transition hover:bg-goospe-green-dark disabled:opacity-60"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-center text-sm text-goospe-gray/70">
        <Link href="/forgot-password" className="text-goospe-green hover:underline">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  )
}
