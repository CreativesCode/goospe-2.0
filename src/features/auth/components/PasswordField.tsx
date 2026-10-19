'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { fieldClass } from '@/shared/lib/ui'

type PasswordFieldProps = {
  id?: string
  name?: string
  label?: string
  required?: boolean
  minLength?: number
  placeholder?: string
  /** `current-password` (login) o `new-password` (signup/cambio) → autofill y gestores. */
  autoComplete?: 'current-password' | 'new-password'
  /** Contenido a la derecha de la etiqueta (p. ej. el enlace "¿La olvidaste?" de Entrar). */
  labelAside?: React.ReactNode
}

/** Input de contraseña con botón "ojito" para mostrar/ocultar. */
export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'Contraseña',
  required,
  minLength,
  placeholder,
  autoComplete,
  labelAside,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${fieldClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute bottom-0 right-0 top-1.5 flex items-center px-4 text-muted transition hover:text-fg"
        >
          {show ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  )
}
