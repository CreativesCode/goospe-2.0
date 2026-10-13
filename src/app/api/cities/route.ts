import { NextResponse } from 'next/server'
import { getActiveCities } from '@/lib/cities'

// GET /api/cities — ciudades activas (nombre, centro y nº de lugares) para el selector de ciudad.
// Dato público e igual para todos: se cachea en el CDN. Si la lectura falla no se cachea el vacío.
export async function GET() {
  const cities = await getActiveCities()
  return NextResponse.json(
    { cities },
    {
      headers: {
        'Cache-Control': cities.length
          ? 'public, s-maxage=3600, stale-while-revalidate=86400'
          : 'no-store',
      },
    }
  )
}
