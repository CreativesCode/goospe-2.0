import { headers } from 'next/headers'

// El cargador de zonas corre SOLO en la máquina del dev (usa sus llaves y hace spawn del ETL).
// Esta comprobación server-side bloquea la ruta/acción en cualquier deploy que no sea localhost.
// (El menú oculto NO es seguridad: este es el gate real.)
export async function isLocalhostRequest(): Promise<boolean> {
  const h = await headers()
  const host = (h.get('host') ?? '').toLowerCase()
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]') ||
    host.startsWith('0.0.0.0')
  )
}
