/** Clases compartidas del backoffice (rediseño audaz). */

/** Título de sección: peso 300 con la palabra clave en 500, algo menor que `pageTitle`. */
export const adminTitle = 'text-[clamp(28px,2.6vw,36px)] font-light leading-[1.08] tracking-[-0.025em] text-fg'

/** Chip de filtro compacto (listas largas del backoffice); activo en verde sólido como `pill`. */
export const adminChip = (on: boolean) =>
  `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
    on ? 'border-goospe-green bg-goospe-green text-on-brand' : 'border-line bg-card text-fg-soft hover:text-fg'
  }`
