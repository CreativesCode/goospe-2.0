import { LegalPage } from '@/shared/components/legal-page'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Goospe',
  description: 'Términos y condiciones de uso de Goospe, el descubridor de lugares y eventos de Puerto Varas.',
  alternates: { canonical: '/terms' },
}

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updatedAt="18 de junio de 2026">
      <p>
        Estos Términos y Condiciones (los “Términos”) regulan el uso de Goospe (la “Plataforma”), un servicio de
        descubrimiento de lugares y eventos enfocado en Puerto Varas, Chile, actualmente en fase piloto y gratuito.
        Al acceder o usar Goospe aceptas estos Términos. Si no estás de acuerdo, no uses la Plataforma.
      </p>

      <h2>1. Qué es Goospe</h2>
      <p>
        Goospe te sugiere lugares (cafés, restaurantes, bares, panoramas) y eventos cercanos, incluyendo un conserje
        asistido por inteligencia artificial que entrega recomendaciones. La información se ofrece con fines
        informativos y de descubrimiento; no constituye una recomendación profesional ni una garantía sobre los
        establecimientos o eventos mostrados.
      </p>

      <h2>2. Uso de la cuenta</h2>
      <ul>
        <li>Puedes navegar de forma anónima o crear una cuenta con tu correo para guardar lugares, reseñar y usar el panel de negocio.</li>
        <li>Eres responsable de la veracidad de los datos que entregas y de mantener segura tu contraseña.</li>
        <li>Debes tener al menos 18 años, o la mayoría de edad en tu jurisdicción, para crear una cuenta.</li>
      </ul>

      <h2>3. Contenido de usuarios</h2>
      <p>
        Al publicar reseñas, fotos, eventos o información de tu negocio, declaras que tienes derecho a hacerlo y nos
        otorgas una licencia no exclusiva para mostrar ese contenido dentro de la Plataforma. No se permite contenido
        ilegal, ofensivo, engañoso o que infrinja derechos de terceros. Podemos moderar, ocultar o eliminar contenido
        que incumpla estos Términos.
      </p>

      <h2>4. Negocios y fichas</h2>
      <p>
        Reclamar una ficha te permite editar su información, publicar eventos y destacarla. Eres responsable de que la
        información de tu negocio sea exacta y esté actualizada. Durante el piloto las funciones de negocio son
        gratuitas; nos reservamos el derecho de introducir planes de pago a futuro, avisando previamente.
      </p>

      <h2>5. Datos de terceros</h2>
      <p>
        Parte de la información y las fotografías de los lugares provienen de fuentes de terceros (por ejemplo Google y
        OpenStreetMap) y se muestran respetando sus condiciones. Goospe no garantiza la exactitud, disponibilidad ni
        vigencia de esos datos.
      </p>

      <h2>6. Conserje IA</h2>
      <p>
        Las recomendaciones del conserje se generan automáticamente y pueden contener errores o imprecisiones. Verifica
        siempre los datos clave (horarios, dirección, disponibilidad) antes de tomar decisiones.
      </p>

      <h2>7. Disponibilidad y cambios</h2>
      <p>
        Al estar en piloto, el servicio puede presentar interrupciones, cambios o errores. Podemos modificar o
        discontinuar funciones en cualquier momento. También podemos actualizar estos Términos; los cambios relevantes
        se reflejarán en esta página con su fecha de actualización.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        Goospe se entrega “tal cual”. En la máxima medida permitida por la ley, no respondemos por daños derivados del
        uso de la Plataforma, de la información de terceros, ni de la experiencia en los establecimientos o eventos
        sugeridos.
      </p>

      <h2>9. Privacidad</h2>
      <p>
        El tratamiento de tus datos personales se rige por nuestra <Link href="/privacy">Política de Privacidad</Link>.
      </p>

      <h2>10. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los
        tribunales competentes de la ciudad de Puerto Varas.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Para consultas sobre estos Términos escríbenos a{' '}
        <a href="mailto:robert.cabrer92@gmail.com">robert.cabrer92@gmail.com</a>.
      </p>
    </LegalPage>
  )
}
