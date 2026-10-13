'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { deleteAccount } from '@/actions/account'
import { createClient } from '@/lib/supabase/client'
import { PasswordField } from '@/features/auth/components/PasswordField'
import { cardClass, dangerBtn, fieldClass, ghostBtn, hintClass, labelClass } from '@/features/business/ui'
import { DELETE_CONFIRM_PHRASE, confirmationMatches } from '@/features/profile/account-deletion'

/**
 * Eliminar la cuenta. `blockers` llega del servidor si la cuenta no se puede eliminar todavía
 * (último dueño de un negocio con lugares, o cuenta admin): en ese caso no hay formulario.
 * `emptyBusinesses` = negocios sin lugares que se borran junto con la cuenta.
 */
export function DeleteAccount({ blockers, emptyBusinesses }: { blockers: string[]; emptyBusinesses: string[] }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverBlockers, setServerBlockers] = useState<string[]>([])
  const blocked = blockers.length > 0 ? blockers : serverBlockers

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await deleteAccount(new FormData(e.currentTarget))
    if (res?.error) {
      setBusy(false)
      setError(res.error)
      if ('blockers' in res && res.blockers) setServerBlockers(res.blockers)
      return
    }
    // Cuenta eliminada: se cierra la sesión del navegador y se sale con una recarga completa
    // (ningún estado en memoria debe sobrevivir).
    try { await createClient().auth.signOut({ scope: 'local' }) } catch { /* ya no existe la sesión */ }
    window.location.assign('/feed')
  }

  return (
    <section id="eliminar" className={`scroll-mt-32 border-red-500/30 ${cardClass}`}>
      <h2 className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
        <AlertTriangle size={18} strokeWidth={1.75} /> Eliminar mi cuenta
      </h2>
      <p className="mt-1 text-sm text-fg-soft">Es definitivo: no se puede deshacer ni recuperar después.</p>

      <div className="mt-4 grid gap-4 text-sm text-fg-soft sm:grid-cols-2">
        <div>
          <p className="font-medium text-fg">Se borra</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Tu perfil, tu foto y tus gustos</li>
            <li>Tus reseñas (y la respuesta del negocio a cada una)</li>
            <li>Las fotos que aportaste a los lugares</li>
            <li>Tus guardados, tus asistencias a eventos y tus notificaciones</li>
            <li>Tus reclamos y solicitudes de negocio</li>
            {emptyBusinesses.map((name) => <li key={name}>El negocio {name} (no tiene lugares)</li>)}
          </ul>
        </div>
        <div>
          <p className="font-medium text-fg">Se conserva sin tu identidad</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Las visitas y toques que suman a las estadísticas de los lugares, ya sin vínculo contigo</li>
            <li>Los comentarios que enviaste a Goospe, como anónimos</li>
            <li>El registro de seguridad de acciones sobre negocios</li>
          </ul>
        </div>
      </div>

      {blocked.length > 0 ? (
        <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Tu cuenta no se puede eliminar todavía</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{blocked.map((b) => <li key={b}>{b}</li>)}</ul>
          <p className="mt-2">
            <Link href="/feedback?tema=account" className="font-medium underline">Escríbenos</Link> y lo resolvemos.
          </p>
        </div>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className={`mt-4 ${dangerBtn}`}>Quiero eliminar mi cuenta</button>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-line pt-4">
          <PasswordField id="delete_current_password" name="current_password" label="Tu contraseña" required autoComplete="current-password" />
          <div>
            <label htmlFor="confirmation" className={labelClass}>
              Escribe <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> para confirmar
            </label>
            <input id="confirmation" name="confirmation" type="text" required autoComplete="off" autoCapitalize="characters"
              spellCheck={false} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={fieldClass} />
            <p className={`mt-1 ${hintClass}`}>Al confirmar se cierra tu sesión en todos tus dispositivos.</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !confirmationMatches(confirmation)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Eliminando…' : 'Eliminar mi cuenta definitivamente'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setConfirmation(''); setError(null) }} className={ghostBtn}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}
