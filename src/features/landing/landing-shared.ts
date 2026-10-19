import type { FeedItem } from '@/features/feed/use-feed'

/** Campos de `get_feed` que usa el carrusel del hero (sin distancia: la semilla no es el visitante). */
export type HeroPlace = Pick<
  FeedItem,
  'slug' | 'name' | 'vibe_line' | 'photo_url' | 'category_name' | 'category_emoji' | 'price_level'
>

/** Contenedor del landing (1240 px) con su padding horizontal: 20 px en móvil, 32 px desde tablet. */
export const landingContainer = 'mx-auto w-full max-w-[1240px] px-5 md:px-8'

/** Eyebrow de sección del landing (tracking más abierto que el de la app). */
export const sectionEyebrow = 'text-xs font-medium uppercase tracking-[0.18em]'

/** H2 de sección: peso 300 con la palabra clave en 500. */
export const sectionTitle = 'text-[clamp(32px,3.6vw,48px)] font-light tracking-[-0.02em]'

/** Botón primario en píldora (verde de marca con texto oscuro). */
export const brandBtn =
  'inline-flex items-center gap-2 rounded-full bg-goospe-green font-medium text-on-brand transition hover:brightness-105'
