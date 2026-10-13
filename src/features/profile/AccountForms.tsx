'use client'

import { useState } from 'react'
import { changeEmail, changePassword } from '@/actions/account'
import { PasswordField } from '@/features/auth/components/PasswordField'
import { toast } from '@/shared/components/toast'
import { cardClass, fieldClass, hintClass, labelClass, primaryBtn, sectionTitle } from '@/features/business/ui'

type Result = { error?: string; success?: boolean } | undefined

// Envía con onSubmit + FormData y limpia el formulario SOLO si la acción tuvo éxito (con
// `action` React reinicia los campos también cuando el servidor devuelve un error).
function useSubmit(action: (fd: FormData) => Promise<Result>, onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(true); setError(null)
    const res = await action(new FormData(form))
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    form.reset()
    onDone()
  }
  return { busy, error, onSubmit }
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [sent, setSent] = useState(false)
  const { busy, error, onSubmit } = useSubmit(changeEmail, () => setSent(true))
  return (
    <form id="email" onSubmit={onSubmit} className={`scroll-mt-32 space-y-4 ${cardClass}`}>
      <div>
        <h2 className={sectionTitle}>Email</h2>
        <p className={hintClass}>Hoy entras con <strong className="font-medium text-fg-soft">{currentEmail}</strong>.</p>
      </div>
      <div>
        <label htmlFor="new_email" className={labelClass}>Nuevo email</label>
        <input id="new_email" name="email" type="email" required autoComplete="email" inputMode="email"
          autoCapitalize="none" spellCheck={false} className={fieldClass} />
      </div>
      <PasswordField id="email_current_password" name="current_password" label="Tu contraseña actual" required autoComplete="current-password" />
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {sent && (
        <p role="status" className="rounded-xl bg-goospe-green/10 px-3 py-2 text-sm text-goospe-green-dark">
          Te enviamos un enlace de confirmación al nuevo email. Tu email no cambia hasta que lo abras (en este mismo navegador).
        </p>
      )}
      <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enviando…' : 'Cambiar email'}</button>
    </form>
  )
}

export function ChangePasswordForm() {
  const { busy, error, onSubmit } = useSubmit(changePassword, () => toast.success('Contraseña actualizada'))
  return (
    <form id="password" onSubmit={onSubmit} className={`scroll-mt-32 space-y-4 ${cardClass}`}>
      <h2 className={sectionTitle}>Contraseña</h2>
      <PasswordField id="pw_current_password" name="current_password" label="Contraseña actual" required autoComplete="current-password" />
      <PasswordField id="new_password" name="new_password" label="Contraseña nueva" required minLength={6} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
    </form>
  )
}
