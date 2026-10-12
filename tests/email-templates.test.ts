import { describe, expect, it } from 'vitest'
import { cleanSubject, compose, esc, safeHref } from '@/emails/layout'
import { claimApprovedEmail, claimNewTeamEmail, claimReceivedEmail, claimRejectedEmail, changeRequestResolvedEmail } from '@/emails/claims'
import { criticalReviewEmail, eventCancelledEmail, eventUpdatedEmail } from '@/emails/alerts'
import { metricRows, numbersDigestEmail, weeklyReportEmail, type ReportEmailProps } from '@/emails/reports'

const XSS = '<script>alert("x")</script>'
const URL_OK = 'https://goospe.vercel.app/panel'

const report: ReportEmailProps = {
  businessName: 'Café del Lago',
  periodLabel: '5 al 11 de octubre',
  panelUrl: URL_OK,
  unsubscribeUrl: 'https://goospe.vercel.app/unsubscribe?token=abc',
  places: [{ name: 'Café del Lago', summary: '• Buena semana\n• Responde la reseña', metrics: { view_detail: 1200, save: 8, dismiss: 3 }, newReviews: 2, panelUrl: URL_OK }],
}

describe('escape', () => {
  it('escapa los cinco caracteres peligrosos', () => {
    expect(esc(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
    expect(esc(null)).toBe('')
    expect(esc(5)).toBe('5')
  })

  it('solo deja pasar enlaces http(s)', () => {
    expect(safeHref('https://goospe.vercel.app/a?b=1&c=2')).toBe('https://goospe.vercel.app/a?b=1&amp;c=2')
    expect(safeHref('javascript:alert(1)')).toBe('#')
    expect(safeHref('data:text/html,x')).toBe('#')
    expect(safeHref('https://x.com/"><script>')).toBe('#')
  })

  it('el asunto no admite saltos de línea ni se desborda', () => {
    expect(cleanSubject('Hola\r\nBcc: x@y.z')).toBe('Hola Bcc: x@y.z')
    expect(cleanSubject('a'.repeat(300)).length).toBe(150)
  })
})

describe('compose', () => {
  const mail = compose({
    subject: 'Asunto', preheader: `Pre ${XSS}`, heading: `Hola ${XSS}`,
    blocks: [
      { type: 'p', text: XSS },
      { type: 'text', text: `línea 1\n${XSS}` },
      { type: 'quote', text: XSS },
      { type: 'heading', text: XSS },
      { type: 'list', items: [XSS] },
      { type: 'stats', rows: [{ label: XSS, value: XSS }] },
      { type: 'link', label: XSS, url: 'javascript:alert(1)' },
    ],
    cta: { label: XSS, url: URL_OK },
    note: XSS,
    unsubscribe: { url: 'https://goospe.vercel.app/unsubscribe?token=t', label: 'Darme de baja' },
  })

  it('ningún bloque deja pasar HTML sin escapar', () => {
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('javascript:')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('respeta los saltos del texto largo y trae el enlace de baja', () => {
    expect(mail.html).toContain('línea 1<br>')
    expect(mail.html).toContain('href="https://goospe.vercel.app/unsubscribe?token=t"')
    expect(mail.text).toContain('Darme de baja: https://goospe.vercel.app/unsubscribe?token=t')
  })

  it('es un documento completo, apto para modo oscuro, con versión en texto', () => {
    expect(mail.html.startsWith('<!doctype html>')).toBe(true)
    expect(mail.html).toContain('name="color-scheme" content="light dark"')
    expect(mail.html).toContain('prefers-color-scheme: dark')
    expect(mail.html).toContain('#2dc186')
    expect(mail.text).not.toMatch(/<br>|<p |style=/)
  })

  it('sin baja no hay enlace de baja', () => {
    const plain = compose({ subject: 's', preheader: 'p', heading: 'h', blocks: [] })
    expect(plain.html).not.toContain('unsubscribe')
  })
})

describe('plantillas', () => {
  const all = [
    claimReceivedEmail({ placeName: XSS, requestsUrl: URL_OK }),
    claimApprovedEmail({ placeName: XSS, panelUrl: URL_OK }),
    claimRejectedEmail({ placeName: XSS, reason: XSS, requestsUrl: URL_OK }),
    claimNewTeamEmail({ placeName: XSS, contactName: XSS, contactEmail: XSS, contactPhone: XSS, message: XSS, adminUrl: URL_OK }),
    changeRequestResolvedEmail({ placeName: XSS, kind: 'name', approved: true, newName: XSS, url: URL_OK }),
    changeRequestResolvedEmail({ placeName: XSS, kind: 'location', approved: false, reason: XSS, url: URL_OK }),
    weeklyReportEmail({ ...report, businessName: XSS, places: [{ ...report.places[0], name: XSS, summary: XSS }] }),
    numbersDigestEmail({ ...report, businessName: XSS, places: [{ ...report.places[0], name: XSS }] }),
    criticalReviewEmail({ placeName: XSS, rating: 1, body: XSS, panelUrl: URL_OK, unsubscribeUrl: null }),
    eventCancelledEmail({ eventName: XSS, placeName: XSS, when: XSS, reason: XSS, placeUrl: URL_OK, unsubscribeUrl: null }),
    eventUpdatedEmail({ eventName: XSS, placeName: XSS, when: XSS, placeUrl: URL_OK, unsubscribeUrl: null }),
  ]

  it('todas escapan lo que interpolan y traen asunto, HTML y texto', () => {
    for (const mail of all) {
      expect(mail.html).not.toContain('<script>')
      expect(mail.subject.length).toBeGreaterThan(0)
      expect(mail.subject).not.toMatch(/[\r\n]/)
      expect(mail.text.length).toBeGreaterThan(20)
      expect(mail.html).toContain(URL_OK)
    }
  })

  it('el rechazo muestra el motivo', () => {
    const mail = claimRejectedEmail({ placeName: 'Café del Lago', reason: 'No pudimos verificar el teléfono', requestsUrl: URL_OK })
    expect(mail.html).toContain('No pudimos verificar el teléfono')
    expect(mail.text).toContain('> No pudimos verificar el teléfono')
    expect(mail.subject).toContain('Café del Lago')
  })

  it('lo transaccional no trae enlace de baja', () => {
    expect(claimApprovedEmail({ placeName: 'X', panelUrl: URL_OK }).html).not.toContain('/unsubscribe')
  })

  it('el informe semanal trae el resumen, los números y la baja', () => {
    const mail = weeklyReportEmail(report)
    expect(mail.html).toContain('• Buena semana<br>• Responde la reseña')
    expect(mail.html).toContain('1.200')
    expect(mail.html).toContain('Reseñas nuevas')
    expect(mail.html).toContain('Dejar de recibir el informe semanal')
    expect(mail.html).not.toContain('dismiss')
  })

  it('el resumen de números no incluye texto de la IA', () => {
    const mail = numbersDigestEmail(report)
    expect(mail.html).not.toContain('Buena semana')
    expect(mail.html).toContain('Guardados')
    expect(mail.html).toContain('Dejar de recibir el resumen de números')
  })

  it('con varios lugares cada uno tiene su sección y su enlace', () => {
    const two = { ...report, places: [report.places[0], { ...report.places[0], name: 'Bar del Puerto', panelUrl: `${URL_OK}/2` }] }
    const mail = weeklyReportEmail(two)
    expect(mail.html).toContain('Bar del Puerto')
    expect(mail.html).toContain(`${URL_OK}/2`)
  })

  it('metricRows omite ceros y lo que no le dice nada al dueño', () => {
    expect(metricRows({ view_detail: 3, save: 0, unsave: 9, dismiss: 4 }, 0)).toEqual([{ label: 'Vistas de tu ficha', value: '3' }])
    expect(metricRows({}, 2)).toEqual([{ label: 'Reseñas nuevas', value: '2' }])
  })

  it('la alerta de reseña crítica cita la reseña', () => {
    const mail = criticalReviewEmail({ placeName: 'Café', rating: 2, body: 'Muy lento', panelUrl: URL_OK, unsubscribeUrl: 'https://goospe.vercel.app/unsubscribe?token=z' })
    expect(mail.subject).toBe('Reseña crítica en Café (2 de 5)')
    expect(mail.html).toContain('Muy lento')
    expect(mail.html).toContain('Dejar de recibir alertas de reseñas')
  })
})
