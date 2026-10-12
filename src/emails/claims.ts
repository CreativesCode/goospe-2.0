import { compose, type EmailContent } from '@/emails/layout'

// Emails transaccionales del ciclo de un reclamo y de las solicitudes de cambio. Funciones
// puras: reciben datos y URLs absolutas ya resueltas y devuelven { subject, html, text }.
// No llevan enlace de baja: responden a algo que la persona pidió.

const WHY_CLAIM = 'Recibes este correo porque pediste administrar un lugar en Goospe.'

/** Al solicitante: recibimos tu reclamo. */
export function claimReceivedEmail(p: { placeName: string; requestsUrl: string }): EmailContent {
  return compose({
    subject: `Recibimos tu solicitud para administrar ${p.placeName}`,
    preheader: 'La revisa una persona de nuestro equipo. Te avisamos apenas esté lista.',
    heading: '¡Recibimos tu solicitud!',
    blocks: [
      { type: 'p', text: `Pediste administrar ${p.placeName} en Goospe. Una persona de nuestro equipo la revisa a mano para confirmar que el negocio es tuyo.` },
      { type: 'p', text: 'Puede que te contactemos al teléfono que nos dejaste. Apenas esté resuelta te escribimos a este mismo correo.' },
    ],
    cta: { label: 'Ver mi solicitud', url: p.requestsUrl },
    note: WHY_CLAIM,
  })
}

/** Al solicitante: reclamo aprobado. Hace de bienvenida al panel (primeros pasos). */
export function claimApprovedEmail(p: { placeName: string; panelUrl: string }): EmailContent {
  return compose({
    subject: `¡Ya administras ${p.placeName} en Goospe!`,
    preheader: 'Tu reclamo fue aprobado. Estos son los primeros pasos para sacarle partido.',
    heading: `¡Ya administras ${p.placeName}!`,
    blocks: [
      { type: 'p', text: 'Aprobamos tu reclamo. Desde hoy tu panel está abierto y lo que cambies se ve al instante en tu ficha pública.' },
      { type: 'heading', text: 'Para partir con el pie derecho' },
      { type: 'list', items: [
        'Completa tu ficha: descripción, horario y cómo contactarte.',
        'Sube tu portada y un par de fotos propias.',
        'Publica tu próximo evento o panorama.',
        'Responde tus reseñas: la gente lo nota.',
      ] },
      { type: 'p', text: 'Cada lunes te mandaremos un resumen de cómo le fue a tu lugar en la semana.' },
    ],
    cta: { label: 'Abrir mi panel', url: p.panelUrl },
    note: WHY_CLAIM,
  })
}

/** Al solicitante: reclamo rechazado, con el motivo que escribió el equipo. */
export function claimRejectedEmail(p: { placeName: string; reason: string; requestsUrl: string }): EmailContent {
  return compose({
    subject: `No pudimos aprobar tu reclamo de ${p.placeName}`,
    preheader: 'Te contamos el motivo y cómo volver a intentarlo.',
    heading: 'No pudimos aprobar tu reclamo',
    blocks: [
      { type: 'p', text: `Revisamos tu solicitud para administrar ${p.placeName} y por ahora no pudimos aprobarla.` },
      { type: 'heading', text: 'Motivo' },
      { type: 'quote', text: p.reason },
      { type: 'p', text: 'Si crees que es un error o ya tienes cómo acreditarlo, puedes enviar una nueva solicitud cuando quieras.' },
    ],
    cta: { label: 'Ver mis solicitudes', url: p.requestsUrl },
    note: WHY_CLAIM,
  })
}

/** Al equipo: hay un reclamo nuevo por revisar. */
export function claimNewTeamEmail(p: {
  placeName: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null
  message: string | null; adminUrl: string
}): EmailContent {
  const rows = [
    { label: 'Lugar', value: p.placeName },
    ...(p.contactName ? [{ label: 'Lo solicita', value: p.contactName }] : []),
    ...(p.contactEmail ? [{ label: 'Email', value: p.contactEmail }] : []),
    ...(p.contactPhone ? [{ label: 'Teléfono', value: p.contactPhone }] : []),
  ]
  return compose({
    subject: `Nuevo reclamo por revisar: ${p.placeName}`,
    preheader: p.contactName ? `Lo solicita ${p.contactName}.` : 'Hay un reclamo pendiente en el backoffice.',
    heading: 'Nuevo reclamo por revisar',
    blocks: [
      { type: 'stats', rows },
      ...(p.message ? [{ type: 'quote' as const, text: p.message }] : []),
    ],
    cta: { label: 'Revisar en el backoffice', url: p.adminUrl },
    note: 'Aviso interno para el equipo de Goospe.',
  })
}

/** Al dueño: su solicitud de cambio de nombre / ubicación fue aprobada o rechazada. */
export function changeRequestResolvedEmail(p: {
  placeName: string | null; kind: 'name' | 'location'; approved: boolean
  newName?: string | null; reason?: string | null; url: string
}): EmailContent {
  const what = p.kind === 'name' ? 'nombre' : 'ubicación'
  const place = p.placeName ?? 'tu lugar'
  if (p.approved) {
    return compose({
      subject: `Aprobamos tu cambio de ${what}`,
      preheader: `Ya está aplicado en la ficha de ${place}.`,
      heading: `Aprobamos tu cambio de ${what}`,
      blocks: [
        { type: 'p', text: p.kind === 'name' && p.newName
          ? `Tu lugar ahora se llama ${p.newName}. El enlace de tu ficha sigue siendo el mismo.`
          : `Ya movimos el pin de ${place} en el mapa.` },
      ],
      cta: { label: 'Ver mi panel', url: p.url },
      note: 'Recibes este correo porque pediste un cambio en tu ficha de Goospe.',
    })
  }
  return compose({
    subject: `No aprobamos tu cambio de ${what}`,
    preheader: 'Te contamos el motivo.',
    heading: `No aprobamos tu cambio de ${what}`,
    blocks: [
      { type: 'p', text: `Revisamos el cambio de ${what} que pediste para ${place} y por ahora no lo aplicamos.` },
      ...(p.reason ? [{ type: 'heading' as const, text: 'Motivo' }, { type: 'quote' as const, text: p.reason }] : []),
      { type: 'p', text: 'Puedes enviar una nueva solicitud con más detalle cuando quieras.' },
    ],
    cta: { label: 'Ver mis solicitudes', url: p.url },
    note: 'Recibes este correo porque pediste un cambio en tu ficha de Goospe.',
  })
}
