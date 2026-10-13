import { ImageResponse } from 'next/og'

// Tarjeta Open Graph generada (1200×630) con la marca Goospe, para fichas y eventos que no
// tienen una foto propia que se pueda compartir. Mismo lenguaje visual que la imagen por
// defecto del sitio (src/app/opengraph-image.tsx).
export const OG_SIZE = { width: 1200, height: 630 }

// Una tarjeta cambia poco: una hora en el navegador, un día en la CDN.
const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export function ogCard({
  eyebrow,
  title,
  subtitle,
  footer,
  status = 200,
  cacheControl = CACHE,
}: {
  /** Línea superior en mayúsculas ("Evento", "Café"). */
  eyebrow: string
  title: string
  subtitle?: string | null
  /** Línea inferior (lugar y ciudad). */
  footer?: string | null
  status?: number
  /** Caché de la respuesta 200. Por defecto la larga (fichas); los eventos usan una corta. */
  cacheControl?: string
}) {
  const heading = clip(title, 80)
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, #28af79 0%, #27f1a0 100%)',
          padding: '80px 96px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: 'rgba(255,255,255,0.88)', letterSpacing: 6, textTransform: 'uppercase' }}>
          Goospe · {clip(eyebrow, 40)}
        </div>
        <div style={{ display: 'flex', fontSize: heading.length > 40 ? 68 : 88, color: '#ffffff', lineHeight: 1.05, marginTop: 36, maxWidth: 1008 }}>
          {heading}
        </div>
        {subtitle ? (
          <div style={{ display: 'flex', fontSize: 40, color: 'rgba(255,255,255,0.94)', marginTop: 28, maxWidth: 1008 }}>
            {clip(subtitle, 110)}
          </div>
        ) : null}
        {footer ? (
          <div style={{ display: 'flex', fontSize: 32, color: 'rgba(255,255,255,0.86)', marginTop: 'auto' }}>
            {clip(footer, 70)}
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE, status, headers: { 'cache-control': status === 200 ? cacheControl : 'no-store' } },
  )
}
