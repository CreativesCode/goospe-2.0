import { redirect } from 'next/navigation'

// Scaffolding sin implementar: el producto usa /feed, /panel y /admin. Se redirige al feed
// para no exponer un placeholder. Reimplementar aquí si se retoma un dashboard propio.
export default function DashboardPage() {
  redirect('/feed')
}
