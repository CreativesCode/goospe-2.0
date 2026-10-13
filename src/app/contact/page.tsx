import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/shared/components/legal-page'
import { CONTACT_EMAIL } from '@/shared/lib/contact'

export const metadata: Metadata = {
  title: 'Contacto | Goospe',
  description: 'Escríbenos: dudas, datos que corregir, tu negocio en Goospe o prensa.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <LegalPage title="Contacto">
      <p>
        Somos un equipo pequeño y leemos todo lo que llega. Escríbenos a{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y te respondemos lo antes posible.
      </p>

      <h2>Antes de escribir</h2>
      <ul>
        <li>
          <strong>Dudas de uso</strong>: lo más probable es que la respuesta esté en la <Link href="/help">ayuda</Link>.
        </li>
        <li>
          <strong>Un dato equivocado en un lugar</strong> (horario, dirección, teléfono, lugar cerrado): cuéntanos el
          nombre del lugar y qué hay que corregir. Si el negocio es tuyo, puedes{' '}
          <Link href="/panel/claim">reclamar la ficha</Link> y editarla tú mismo.
        </li>
        <li>
          <strong>Tu negocio no aparece</strong>: puedes <Link href="/panel/propose">proponerlo</Link> desde el panel.
        </li>
        <li>
          <strong>Ideas o problemas con la app</strong>: usa <Link href="/feedback">enviar comentarios</Link>.
        </li>
        <li>
          <strong>Privacidad y datos personales</strong>: revisa la <Link href="/privacy">política de privacidad</Link>;
          las solicitudes se atienden en este mismo correo.
        </li>
      </ul>

      <h2>Contenido inapropiado</h2>
      <p>
        Si encuentras una foto, reseña o evento que no debería estar en Goospe, envíanos el enlace y el motivo. Lo
        revisamos y, si incumple los <Link href="/terms">términos</Link>, lo retiramos.
      </p>
    </LegalPage>
  )
}
