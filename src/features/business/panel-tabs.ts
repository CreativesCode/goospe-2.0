import {
  LayoutDashboard, FileText, Image as ImageIcon, BookOpen, Calendar, Star, TrendingUp, Megaphone, type LucideIcon,
} from 'lucide-react'

// Secciones del panel de un lugar. La activa viaja en `?tab=` (Resumen es la de por defecto y
// no lleva parámetro): el servidor solo carga los datos de la sección que se está viendo.
export const PANEL_TABS = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'ficha', label: 'Ficha', icon: FileText },
  { key: 'fotos', label: 'Fotos', icon: ImageIcon },
  { key: 'carta', label: 'Carta', icon: BookOpen },
  { key: 'eventos', label: 'Eventos', icon: Calendar },
  { key: 'resenas', label: 'Reseñas', icon: Star },
  { key: 'estadisticas', label: 'Estadísticas', icon: TrendingUp },
  { key: 'destacar', label: 'Destacar', icon: Megaphone },
] as const satisfies readonly { key: string; label: string; icon: LucideIcon }[]

export type PanelTab = (typeof PANEL_TABS)[number]['key']

/** Sección pedida en la URL; cualquier valor desconocido cae en Resumen. */
export function parseTab(value: unknown): PanelTab {
  return PANEL_TABS.find((t) => t.key === value)?.key ?? 'resumen'
}

export const tabLabel = (tab: PanelTab): string => PANEL_TABS.find((t) => t.key === tab)?.label ?? ''

export const tabHref = (placeId: string, tab: PanelTab): string =>
  tab === 'resumen' ? `/panel/${placeId}` : `/panel/${placeId}?tab=${tab}`
