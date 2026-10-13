import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/shared/components/legal-page'
import { JsonLd } from '@/shared/components/json-ld'

export const metadata: Metadata = {
  title: 'Ayuda y preguntas frecuentes | Goospe',
  description: 'Cómo usar Goospe: guardar lugares, eventos, reseñas y cómo reclamar y administrar la ficha de tu negocio.',
  alternates: { canonical: '/help' },
}

// `a` es texto plano: es lo que se muestra y lo que va en los datos estructurados (FAQPage).
type Faq = { q: string; a: string }

const FOR_USERS: Faq[] = [
  { q: '¿Goospe es gratis?', a: 'Sí. Goospe está en fase piloto y es gratuito para quienes buscan a dónde ir.' },
  { q: '¿Necesito una cuenta?', a: 'No para explorar: puedes ver el feed, las fichas y la cartelera sin registrarte, y guardar lugares en tu dispositivo. La cuenta sirve para conservar tus guardados, escribir reseñas, subir fotos y responder a eventos.' },
  { q: '¿Cómo sabe Goospe qué hay cerca de mí?', a: 'Con la ubicación de tu dispositivo, si la permites. Solo se usa para ordenar lo que te mostramos. Si no la compartes, puedes explorar igual por ciudad.' },
  { q: '¿Qué es Decídeme?', a: 'Es el conserje de Goospe: le cuentas qué tienes ganas de hacer y te recomienda lugares cercanos usando inteligencia artificial. Las recomendaciones pueden tener errores; confirma horario y dirección antes de salir.' },
  { q: '¿Qué diferencia hay entre “Me interesa” y “Asistiré” en un evento?', a: '“Me interesa” guarda el evento para ti y le dice al organizador que hay interés. “Asistiré” confirma que vas y suma al conteo público de asistentes. Puedes cambiar o quitar tu respuesta cuando quieras, y si el evento cambia de fecha o se cancela te avisamos.' },
  { q: '¿Puedo agregar un evento a mi calendario?', a: 'Sí. En la página de cada evento hay un botón para Google Calendar y otro que descarga un archivo .ics compatible con Apple Calendar y Outlook.' },
  { q: '¿De dónde salen las fotos y los datos de los lugares?', a: 'De fuentes abiertas y de terceros (como OpenStreetMap y Google), de los propios dueños y de la comunidad. Los resúmenes se generan con inteligencia artificial a partir de esos datos.' },
  { q: 'Encontré un dato equivocado. ¿Qué hago?', a: 'Escríbenos desde la página de contacto con el nombre del lugar y lo que hay que corregir. Si el negocio es tuyo, puedes reclamar la ficha y editarla directamente.' },
  { q: '¿Cómo se moderan las reseñas y las fotos?', a: 'El contenido ofensivo, engañoso o que no corresponde al lugar se oculta o se elimina. Las fotos que sube la comunidad se revisan antes de publicarse.' },
]

const FOR_OWNERS: Faq[] = [
  { q: '¿Cómo reclamo la ficha de mi negocio?', a: 'Entra al panel de negocios, busca tu lugar y envía la solicitud con tus datos de contacto. El equipo la verifica a mano y te avisa cuando queda aprobada o si falta información.' },
  { q: 'Mi negocio no aparece en Goospe. ¿Puedo agregarlo?', a: 'Sí. Desde el panel puedes proponer un lugar nuevo; lo revisamos y, al aprobarlo, queda publicado y a tu nombre.' },
  { q: '¿Cuánto cuesta?', a: 'Durante el piloto, administrar tu ficha es gratis. Si más adelante hay planes de pago, lo avisaremos con anticipación.' },
  { q: '¿Qué puedo hacer desde el panel?', a: 'Editar los datos de tu ficha (descripción, horario, contacto, carta), subir portada, logo y fotos, publicar y cancelar eventos, responder reseñas y ver cuánta gente vio, guardó o pidió cómo llegar a tu lugar.' },
  { q: '¿Cómo publico un evento?', a: 'En el panel de tu lugar, sección Eventos. Indica nombre, fecha y hora (en la hora local de tu ciudad) y, si quieres, una imagen. El evento aparece en la cartelera, en tu ficha y en el feed de quienes están cerca, y tiene su propia página para compartir.' },
  { q: '¿Qué pasa si cambio la fecha o cancelo un evento?', a: 'Avisamos a quienes marcaron “Me interesa” o “Asistiré”. El evento cancelado conserva su página, con el aviso de cancelación.' },
  { q: '¿Puedo ocultar mi lugar por un tiempo?', a: 'Sí. En el panel puedes pausar tu ficha (por ejemplo, por vacaciones o remodelación) y reactivarla cuando quieras. Mientras está pausada no aparece en Goospe.' },
  { q: '¿Quién puede ver mis estadísticas?', a: 'Solo las personas con acceso al panel de tu negocio. Los conteos de asistentes a un evento son públicos, pero nunca muestran nombres.' },
]

function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card">
      {items.map((f) => (
        <details key={f.q} className="group px-4 py-3">
          <summary className="cursor-pointer list-none font-medium text-fg [&::-webkit-details-marker]:hidden">
            <span className="flex items-start justify-between gap-3">
              {f.q}
              <span aria-hidden className="mt-0.5 shrink-0 text-muted transition group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="mt-2 leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export default function HelpPage() {
  return (
    <LegalPage title="Ayuda">
      <p>
        Las dudas más comunes sobre Goospe. Si no encuentras la tuya, <Link href="/contact">escríbenos</Link>.
      </p>

      <h2 id="usuarios">Para quienes buscan a dónde ir</h2>
      <FaqList items={FOR_USERS} />

      <h2 id="negocios">Para dueños de negocio</h2>
      <FaqList items={FOR_OWNERS} />
      <p>
        ¿Listo para empezar? Entra al <Link href="/panel">panel de negocios</Link>.
      </p>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [...FOR_USERS, ...FOR_OWNERS].map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
    </LegalPage>
  )
}
