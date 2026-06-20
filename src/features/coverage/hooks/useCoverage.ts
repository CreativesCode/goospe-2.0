'use client'

import { useEffect, useState } from 'react'
import { getPosition, type GeoSource } from '@/lib/geo'
import { resolveCoverage, type CoverageCity } from '../services/coverage'

type Coords = { lat: number; lng: number }

// Estado de cobertura del usuario:
// - loading   : resolviendo posición + cobertura.
// - covered   : dentro de una ciudad activa (city) — o degradación suave si la RPC falló (city=null).
// - uncovered : posición real fuera de toda zona activa → se muestra la pantalla "pronto".
export type CoverageState =
  | { status: 'loading' }
  | { status: 'covered'; city: CoverageCity | null; coords: Coords; source: GeoSource }
  | { status: 'uncovered'; coords: Coords; source: GeoSource }

/**
 * Determina si el usuario está dentro de cobertura.
 * Reusa getPosition() (respeta NEXT_PUBLIC_FORCE_LOCATION: el dev controla las coords,
 * incl. forzar una ciudad sin cobertura para probar la pantalla "pronto").
 * Ante un error de la RPC NO bloquea: degrada a 'covered' con city=null.
 */
export function useCoverage(): CoverageState {
  const [state, setState] = useState<CoverageState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void (async () => {
      const pos = await getPosition()
      const coords: Coords = { lat: pos.lat, lng: pos.lng }
      try {
        const city = await resolveCoverage(pos.lat, pos.lng)
        if (!active) return
        setState(
          city
            ? { status: 'covered', city, coords, source: pos.source }
            : { status: 'uncovered', coords, source: pos.source }
        )
      } catch {
        // Error transitorio de red/RPC → no bloqueamos al usuario.
        if (active) setState({ status: 'covered', city: null, coords, source: pos.source })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return state
}
