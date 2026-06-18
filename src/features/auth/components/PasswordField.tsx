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
}

/** Input de contraseña con botón "ojito" para mostrar/ocultar. */
export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'Contraseña',
  required,
  minLength,
  placeholder,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-fg"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}
