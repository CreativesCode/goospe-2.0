'use client'

import { useTransition } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { setPublished } from '@/actions/admin-places'

/** Botón rápido para publicar/ocultar un lugar desde la lista del backoffice. */
export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('next', String(!published))
    startTransition(() => { void setPublished(fd) })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={published ? 'Ocultar' : 'Publicar'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        published
          ? 'border-goospe-green/30 bg-goospe-green/10 text-goospe-green-dark'
          : 'border-line bg-surface text-muted hover:text-fg'
      }`}
    >
      {published ? <Eye size={13} /> : <EyeOff size={13} />}
      {published ? 'Publicado' : 'Oculto'}
    </button>
  )
}
