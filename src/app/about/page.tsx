import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/shared/components/legal-page'

export const metadata: Metadata = {
  title: 'Quiénes somos | Goospe',
  description: 'Goospe te ayuda a decidir a dónde ir hoy: lugares y eventos cerca de ti, con la información que de verdad sirve para elegir.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <LegalPage title="Quiénes somos">
      <p>
        Goospe nació de una pregunta que todos nos hacemos varias veces por semana: <strong>¿dónde voy hoy?</strong>{' '}
        Somos un descubridor de lugares y eventos locales: cafés, restaurantes, bares y panoramas, ordenados para
        que elegir tome segundos y no media hora de pestañas abiertas.
      </p>

      <h2>Qué hacemos</h2>
      <ul>
        <li>
          Un <Link href="/feed">feed</Link> con lo que hay cerca de ti: fotos, ambiente, precio y si está abierto ahora.
        </li>
        <li>
          Un conserje con inteligencia artificial, <Link href="/concierge">Decídeme</Link>, que te recomienda a dónde ir
          según lo que tienes ganas de hacer.
        </li>
        <li>
          Una <Link href="/events">cartelera</Link> con los eventos de los lugares, para marcar los que te interesan o
          confirmar tu asistencia.
        </li>
        <li>
          Un panel para <Link href="/panel">dueños de negocio</Link>: administrar la ficha, publicar eventos, responder
          reseñas y ver cuánta gente los encuentra.
        </li>
      </ul>

      <h2>Dónde estamos</h2>
      <p>
        Goospe está en fase piloto y es gratuito. Partimos en Puerto Varas y el sur de Chile, y hoy también cubrimos
        ciudades de España. Puedes ver todas en <Link href="/places">lugares por ciudad</Link>.
      </p>

      <h2>De dónde sale la información</h2>
      <p>
        Los datos de base de cada lugar provienen de fuentes abiertas y de terceros (como OpenStreetMap y Google) y se
        completan con resúmenes generados con inteligencia artificial. Los dueños pueden reclamar su ficha y
        corregirla, y cualquier persona puede aportar fotos y reseñas. Si ves un dato equivocado,{' '}
        <Link href="/contact">avísanos</Link>.
      </p>

      <h2>¿Tienes un negocio?</h2>
      <p>
        Reclamar tu ficha es gratis durante el piloto. Empieza en <Link href="/panel">el panel de negocios</Link> o
        revisa las <Link href="/help">preguntas frecuentes</Link>.
      </p>
    </LegalPage>
  )
}
