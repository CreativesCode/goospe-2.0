'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
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
    <form action={handle} className="space-y-3.5">
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-fg">Nombre</label>
        <input id="display_name" name="display_name" type="text" autoComplete="name" className={fieldClass} placeholder="Cómo quieres que te llamemos" />
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
      <label className="flex items-start gap-2.5 text-sm leading-[1.45] text-fg-soft">
        {/* Checkbox nativo (conserva `required` y el foco) con la apariencia del diseño: 20 px, radio 6. */}
        <span className="relative mt-px flex h-5 w-5 shrink-0">
          <input
            type="checkbox"
            name="terms"
            required
            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-line bg-card outline-none transition checked:border-goospe-green checked:bg-goospe-green focus-visible:border-goospe-green focus-visible:shadow-[0_0_0_4px_rgba(45,193,134,0.12)]"
          />
          <Check size={13} strokeWidth={3} aria-hidden className="pointer-events-none absolute inset-0 m-auto hidden text-on-brand peer-checked:block" />
        </span>
        <span>
          Acepto los{' '}
          <Link href="/terms" target="_blank" className="text-ink hover:underline">Términos y Condiciones</Link> y la{' '}
          <Link href="/privacy" target="_blank" className="text-ink hover:underline">Política de privacidad</Link>.
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={`${primaryBtn} !mt-5`}>
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
