// Layout común de los emails de Goospe. HTML en strings (sin React Email): tablas, estilos
// en línea y una hoja mínima para modo oscuro (los clientes que la ignoran ven el tema claro).
//
// Las plantillas NO escriben HTML: describen el contenido con bloques y `compose` genera el
// HTML y el texto plano desde los mismos datos. Todo valor interpolado pasa por `esc` aquí,
// así que una plantilla nueva no puede olvidarse de escapar.

export type EmailContent = { subject: string; html: string; text: string }

export type Block =
  | { type: 'p'; text: string }
  /** Texto de varias líneas (resumen de la IA, motivo): respeta los saltos. */
  | { type: 'text'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'stats'; rows: { label: string; value: string }[] }
  | { type: 'link'; label: string; url: string }

export type ComposeInput = {
  subject: string
  /** Texto de vista previa de la bandeja (no se ve en el cuerpo). */
  preheader: string
  heading: string
  blocks: Block[]
  cta?: { label: string; url: string } | null
  /** Línea gris bajo el botón (por qué recibes esto). */
  note?: string | null
  /** Enlace de baja; solo en emails que se pueden dar de baja. */
  unsubscribe?: { url: string; label: string } | null
}

export const BRAND = {
  name: 'Goospe',
  green: '#2dc186', // goospe-green de tailwind.config.ts
  greenDark: '#28af79',
  bg: '#f4f2ec',
  card: '#ffffff',
  fg: '#1c1c1a',
  muted: '#6b6b66',
  line: '#e5e1d8',
} as const

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escapa un valor para texto o atributo HTML. null/undefined → cadena vacía. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/** Solo http(s): cualquier otro esquema (javascript:, data:) se reemplaza por "#". */
export function safeHref(url: string): string {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? esc(url) : '#'
}

/** Quita saltos y controles: un asunto no puede traer cabeceras inyectadas. */
export function cleanSubject(s: string, max = 150): string {
  const flat = s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const nl2br = (s: string) => esc(s.trim()).replace(/\r?\n/g, '<br>')
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const P = `margin:0 0 16px;font-size:16px;line-height:24px;color:${BRAND.fg};`

function blockHtml(b: Block): string {
  switch (b.type) {
    case 'p':
      return `<p class="fg" style="${P}">${esc(b.text)}</p>`
    case 'text':
      return `<p class="fg" style="${P}">${nl2br(b.text)}</p>`
    case 'quote':
      return `<p class="fg line" style="${P}padding:12px 16px;border-left:3px solid ${BRAND.green};background:rgba(45,193,134,0.08);border-radius:0 8px 8px 0;">${nl2br(b.text)}</p>`
    case 'heading':
      return `<h2 class="fg" style="margin:24px 0 8px;font-size:17px;line-height:24px;font-weight:600;color:${BRAND.fg};">${esc(b.text)}</h2>`
    case 'list':
      return `<ul class="fg" style="margin:0 0 16px;padding:0 0 0 20px;font-size:16px;line-height:24px;color:${BRAND.fg};">${b.items.map((i) => `<li style="margin:0 0 6px;">${esc(i)}</li>`).join('')}</ul>`
    case 'stats':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">${b.rows
        .map((r) => `<tr><td class="muted line" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:15px;line-height:22px;color:${BRAND.muted};">${esc(r.label)}</td><td class="fg line" align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:16px;line-height:22px;font-weight:600;color:${BRAND.fg};">${esc(r.value)}</td></tr>`)
        .join('')}</table>`
    case 'link':
      return `<p style="${P}"><a href="${safeHref(b.url)}" style="color:${BRAND.greenDark};font-weight:600;text-decoration:underline;">${esc(b.label)}</a></p>`
  }
}

function blockText(b: Block): string {
  switch (b.type) {
    case 'p':
    case 'text':
      return b.text.trim()
    case 'quote':
      return b.text.trim().split(/\r?\n/).map((l) => `> ${l}`).join('\n')
    case 'heading':
      return `## ${b.text}`
    case 'list':
      return b.items.map((i) => `- ${i}`).join('\n')
    case 'stats':
      return b.rows.map((r) => `${r.label}: ${r.value}`).join('\n')
    case 'link':
      return `${b.label}: ${b.url}`
  }
}

function buttonHtml(cta: { label: string; url: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td align="center" bgcolor="${BRAND.greenDark}" style="border-radius:999px;background:${BRAND.greenDark};"><a href="${safeHref(cta.url)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(cta.label)}</a></td></tr></table>`
}

/** Arma el email completo (HTML + texto) desde una descripción por bloques. */
export function compose(input: ComposeInput): EmailContent {
  const subject = cleanSubject(input.subject)
  const footer = input.unsubscribe
    ? `<a href="${safeHref(input.unsubscribe.url)}" style="color:${BRAND.muted};text-decoration:underline;">${esc(input.unsubscribe.label)}</a>`
    : ''

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .bg { background: #121413 !important; }
  .card { background: #1c1f1d !important; }
  .fg { color: #f1f1ee !important; }
  .muted { color: #a5a8a3 !important; }
  .line { border-color: #2e322f !important; }
}
@media (max-width: 620px) { .pad { padding: 24px 20px !important; } }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(input.preheader)}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:4px 8px 16px;font-family:${FONT};font-size:24px;line-height:28px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.green};">${BRAND.name}</td></tr>
<tr><td class="card pad" style="padding:32px;background:${BRAND.card};border-radius:16px;font-family:${FONT};">
<h1 class="fg" style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:600;color:${BRAND.fg};">${esc(input.heading)}</h1>
${input.blocks.map(blockHtml).join('\n')}
${input.cta ? buttonHtml(input.cta) : ''}
${input.note ? `<p class="muted" style="margin:0;font-size:13px;line-height:20px;color:${BRAND.muted};">${esc(input.note)}</p>` : ''}
</td></tr>
<tr><td class="muted" align="center" style="padding:20px 16px;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">
Goospe · ¿dónde voy hoy?${footer ? `<br>${footer}` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    input.heading,
    '',
    ...input.blocks.flatMap((b) => [blockText(b), '']),
    ...(input.cta ? [`${input.cta.label}: ${input.cta.url}`, ''] : []),
    ...(input.note ? [input.note, ''] : []),
    '—',
    'Goospe · ¿dónde voy hoy?',
    ...(input.unsubscribe ? [`${input.unsubscribe.label}: ${input.unsubscribe.url}`] : []),
  ].join('\n')

  return { subject, html, text }
}
