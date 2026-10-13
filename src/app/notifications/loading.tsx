import { Loader } from '@/shared/components/loader'

/**
 * Loading de navegación de este segmento (animación de marca a pantalla completa).
 * Vive aquí y NO en la raíz: un `loading.tsx` raíz envuelve toda la app en un Suspense, y un
 * `notFound()` lanzado dentro de un Suspense ya no puede cambiar el estado HTTP (la ficha, los
 * listados /c/** y los eventos respondían 200 con la pantalla de 404).
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface">
      <Loader size={130} />
    </div>
  )
}
