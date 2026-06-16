import { redirect } from 'next/navigation'

// Entrada de la app → el feed (descubrimiento anónimo, sin login por diseño).
export default function Home() {
  redirect('/feed')
}
