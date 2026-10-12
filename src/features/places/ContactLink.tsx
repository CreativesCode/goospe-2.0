'use client'

import type { ReactNode } from 'react'
import { track } from '@/lib/track'

type Channel = 'phone' | 'whatsapp' | 'email'

// Solo dígitos (y el + inicial) para armar tel: / wa.me a partir de lo que escribió el dueño.
const digits = (v: string) => v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')

function hrefFor(channel: Channel, value: string): string | null {
  const v = value.trim()
  if (channel === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `mailto:${v}` : null
  const d = digits(v)
  if (d.replace('+', '').length < 6) return null // demasiado corto para ser un número real
  return channel === 'phone' ? `tel:${d}` : `https://wa.me/${d.replace('+', '')}`
}

/**
 * Contacto accionable de la ficha (llamar / WhatsApp / email). Registra la interacción `call`
 * con el canal en `context` → alimenta las estadísticas del panel del negocio.
 * Si el valor no sirve para armar un enlace se muestra como texto plano.
 */
export function ContactLink({
  placeId,
  channel,
  value,
  children,
}: {
  placeId: string
  channel: Channel
  value: string
  children?: ReactNode
}) {
  const href = hrefFor(channel, value)
  if (!href) return <>{children ?? value}</>
  const external = channel === 'whatsapp'
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      onClick={() => track('call', { placeId, context: { channel } })}
      className="text-goospe-green hover:underline"
    >
      {children ?? value}
    </a>
  )
}
