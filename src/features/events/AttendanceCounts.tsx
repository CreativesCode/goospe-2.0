import { Star, Users } from 'lucide-react'

/**
 * Muestra SOLO conteos agregados de un evento (nunca nombres ni datos personales): cuántos
 * asistirán (con desglose hombres/mujeres) y, aparte, a cuántos les interesa. "Me interesa" no
 * suma a la asistencia. Usa `currentColor`, así que se adapta al color del contexto (tarjeta
 * clara o feed sobre foto). No renderiza nada si aún no hay respuestas.
 */
export function AttendanceCounts({
  going,
  male,
  female,
  interested = 0,
  className = '',
}: {
  going: number
  male: number
  female: number
  interested?: number
  className?: string
}) {
  if (!going && !interested) return null
  const hasGender = male > 0 || female > 0
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {going > 0 && (
        <span className="inline-flex items-center gap-1 font-medium">
          <Users size={14} strokeWidth={1.75} /> {going} {going === 1 ? 'asistirá' : 'asistirán'}
        </span>
      )}
      {going > 0 && hasGender && (
        <span className="text-sm opacity-80">
          · {male} {male === 1 ? 'hombre' : 'hombres'} · {female} {female === 1 ? 'mujer' : 'mujeres'}
        </span>
      )}
      {interested > 0 && (
        <span className="inline-flex items-center gap-1 text-sm opacity-90">
          {going > 0 && <span aria-hidden>·</span>}
          <Star size={13} strokeWidth={1.75} /> {interested} {interested === 1 ? 'interesado' : 'interesados'}
        </span>
      )}
    </span>
  )
}
