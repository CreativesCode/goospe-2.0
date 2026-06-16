'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'

// Registra una vista de ficha al montar. Componente sin UI.
export function DetailTracker({ placeId }: { placeId: string }) {
  useEffect(() => { track('view_detail', { placeId }) }, [placeId])
  return null
}
