import 'server-only'
import { after } from 'next/server'

// Lanza una tarea de email SIN bloquear la respuesta y sin que su fallo llegue a la acción
// (misma idea que src/lib/fire.ts). Usa `after()` de Next: en Vercel mantiene viva la función
// hasta que la tarea termina; un `void promesa` suelto se congela al responder y el email no
// saldría. Fuera de una petición (scripts, tests) `after` lanza y se cae al disparo directo.
export function sendLater(label: string, task: () => Promise<unknown>): void {
  const run = async () => {
    try {
      await task()
    } catch (e) {
      console.error(`[email:${label}]`, (e as Error).message)
    }
  }
  try {
    after(run)
  } catch {
    void run()
  }
}
