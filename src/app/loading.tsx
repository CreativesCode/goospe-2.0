import { Loader } from '@/shared/components/loader'

/**
 * Loading global de navegación: se muestra mientras carga cualquier ruta que no
 * defina su propio `loading.tsx`. Solo la animación de marca, sin fondo extra
 * (hereda la superficie de la app).
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface">
      <Loader size={130} />
    </div>
  )
}
