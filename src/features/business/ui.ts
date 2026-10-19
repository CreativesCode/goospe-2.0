/** Clases compartidas del panel del dueño (tokens semánticos: valen en claro y oscuro). */
export { fieldClass } from '@/shared/lib/ui'

export const labelClass = 'block text-sm font-medium text-fg'
export const cardClass = 'rounded-[22px] border border-line bg-card p-4 sm:p-6'
export const sectionTitle = 'font-medium text-fg'
export const hintClass = 'text-xs text-muted'
/** Botón principal de una tarjeta (alto táctil >= 44 px en móvil). */
export const primaryBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-goospe-green px-5 py-2 text-sm font-medium text-on-brand transition hover:brightness-105 disabled:opacity-60'
export const ghostBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-fg-soft transition hover:border-goospe-green/40 hover:text-fg disabled:opacity-60'
export const dangerBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400'
export const linkBtn = 'inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline disabled:opacity-60'
/** Campo compacto (dentro de listas y editores). */
export const inputSm =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30'
