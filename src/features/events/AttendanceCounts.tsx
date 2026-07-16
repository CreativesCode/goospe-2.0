import { Users } from 'lucide-react'

/**
 * Muestra SOLO conteos agregados de asistentes de un evento (nunca nombres ni datos personales):
 * total que asistirán + desglose hombres/mujeres. Usa `currentColor`, así que se adapta al color
 * del contexto (tarjeta clara o feed sobre foto). No renderiza nada si aún no hay asistentes.
 */
export function AttendanceCounts({
  going,
  male,
  female,
  className = '',
}: {
  going: number
  male: number
  female: number
  className?: string
}) {
  if (!going) return null
  const hasGender = male > 0 || female > 0
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <span className="inline-flex items-center gap-1 font-medium">
        <Users size={14} strokeWidth={1.75} /> {going} {going === 1 ? 'asistirá' : 'asistirán'}
      </span>
      {hasGender && (
        <span className="text-sm opacity-80">
          · {male} {male === 1 ? 'hombre' : 'hombres'} · {female} {female === 1 ? 'mujer' : 'mujeres'}
        </span>
      )}
    </span>
  )
}
