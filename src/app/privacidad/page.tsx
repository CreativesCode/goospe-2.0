import { LegalPage } from '@/shared/components/legal-page'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Goospe',
  description: 'Cómo Goospe recopila, usa y protege tus datos personales conforme a la Ley N° 19.628 de Chile.',
  alternates: { canonical: '/privacidad' },
}

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updatedAt="18 de junio de 2026">
      <p>
        En Goospe respetamos tu privacidad. Esta Política explica qué datos recopilamos, con qué fin y cómo los
        protegemos, en conformidad con la Ley N° 19.628 sobre Protección de la Vida Privada de Chile. Al usar la
        Plataforma aceptas las prácticas aquí descritas.
      </p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> correo electrónico y, opcionalmente, nombre y preferencias de gusto del onboarding.</li>
        <li><strong>De tu actividad:</strong> lugares guardados, reseñas, asistencias a eventos e interacciones (vistas, “cómo llego”, compartidos) para mejorar y personalizar las recomendaciones.</li>
        <li><strong>Del conserje IA:</strong> el texto de tus consultas, para entregarte recomendaciones.</li>
        <li><strong>Técnicos:</strong> un identificador de dispositivo (para la experiencia anónima) y datos básicos de uso.</li>
        <li><strong>De ubicación aproximada:</strong> solo si la autorizas, para mostrarte lugares cercanos.</li>
      </ul>

      <h2>2. Para qué usamos tus datos</h2>
      <ul>
        <li>Operar la Plataforma: feed, búsqueda, guardados, reseñas, eventos y panel de negocio.</li>
        <li>Personalizar y mejorar las recomendaciones según tu gusto, la hora y la cercanía.</li>
        <li>Moderar contenido y mantener la seguridad del servicio.</li>
        <li>Comunicarnos contigo sobre tu cuenta o cambios relevantes del servicio.</li>
      </ul>

      <h2>3. Proveedores que nos ayudan</h2>
      <p>
        Usamos servicios de terceros para operar Goospe, entre ellos infraestructura y base de datos (Supabase),
        modelos de inteligencia artificial para el conserje y las funciones de IA, y fuentes de mapas y fotografías
        (Google, OpenStreetMap, Mapillary). Estos proveedores tratan datos únicamente para prestarnos su servicio.
      </p>

      <h2>4. Personalización e IA</h2>
      <p>
        Para personalizar el feed generamos un perfil de gusto a partir de tus respuestas e interacciones. Las consultas
        al conserje se envían al proveedor de IA para producir las recomendaciones. No usamos tus datos para vender
        publicidad a terceros.
      </p>

      <h2>5. Cookies y almacenamiento local</h2>
      <p>
        Usamos almacenamiento local y cookies técnicas para recordar tu sesión, tus guardados anónimos y tus
        preferencias. No usamos cookies de publicidad de terceros.
      </p>

      <h2>6. Conservación</h2>
      <p>
        Conservamos tus datos mientras mantengas tu cuenta o sean necesarios para los fines descritos. Si eliminas tu
        cuenta, eliminamos o anonimizamos tus datos personales, salvo lo que debamos conservar por obligación legal.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Tienes derecho a acceder, rectificar, eliminar y oponerte al tratamiento de tus datos personales. Para
        ejercerlos, escríbenos a <a href="mailto:robert.cabrer92@gmail.com">robert.cabrer92@gmail.com</a> y responderemos en un plazo
        razonable.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables —incluyendo control de acceso a nivel de fila (RLS) en la
        base de datos— para proteger tus datos. Ningún sistema es 100% infalible, pero trabajamos para minimizar los
        riesgos.
      </p>

      <h2>9. Menores</h2>
      <p>
        Goospe no está dirigido a menores de edad. No recopilamos conscientemente datos de personas menores de 18 años.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar esta Política. Los cambios se publicarán en esta página con su fecha de actualización.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Para cualquier consulta sobre privacidad escríbenos a <a href="mailto:robert.cabrer92@gmail.com">robert.cabrer92@gmail.com</a>.
        Consulta también nuestros <Link href="/terminos">Términos y Condiciones</Link>.
      </p>
    </LegalPage>
  )
}
