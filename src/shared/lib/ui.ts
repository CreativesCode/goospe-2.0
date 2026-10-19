/** Clases compartidas de UI con tokens semánticos (claro/oscuro). */

/** Input de formulario (auth, paneles): 50 px, radio 14 y halo de foco de marca. */
export const fieldClass =
  'mt-1.5 block min-h-[50px] w-full rounded-[14px] border border-line bg-card px-4 py-3 text-fg outline-none transition placeholder:text-muted focus:border-goospe-green focus:shadow-[0_0_0_4px_rgba(45,193,134,0.12)]'

/** Botón primario (verde de marca con texto oscuro: el blanco sobre #2dc186 no pasa contraste). */
export const primaryBtn =
  'h-[52px] w-full rounded-full bg-goospe-green font-medium text-on-brand transition hover:brightness-105 disabled:opacity-60'

/** Etiqueta de sección en mayúsculas ("eyebrow"). */
export const eyebrow = 'text-xs font-medium uppercase tracking-[0.12em] text-muted'

/** Título de página: peso 300 con la palabra clave en 500 (patrón de marca). */
export const pageTitle = 'text-[clamp(32px,3.4vw,44px)] font-light leading-[1.05] tracking-[-0.025em] text-fg'

/** Contenedor de las páginas de la app (1320 px) con el padding horizontal por breakpoint. */
export const appContainer = 'mx-auto w-full max-w-[1320px] px-4 md:px-6 lg:px-8'

/** Cuerpo estándar de una página de la app: contenedor + respiro vertical del rediseño. */
export const pageShell = `${appContainer} flex-1 pb-14 pt-5 md:pt-7`

/** Chip / píldora de filtro. */
export const pill = (on: boolean) =>
  `inline-flex h-[38px] shrink-0 items-center gap-[7px] rounded-full border px-[15px] text-sm font-medium transition ${
    on ? 'border-goospe-green bg-goospe-green text-on-brand' : 'border-line bg-card text-fg-soft hover:text-fg'
  }`
