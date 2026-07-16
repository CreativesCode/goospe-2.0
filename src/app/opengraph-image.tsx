import { ImageResponse } from 'next/og'

// Imagen Open Graph por defecto de TODO el sitio (file-based metadata de Next).
// Cualquier ruta que no defina su propia imagen hereda esta al compartirse.
// Se genera con la marca Goospe (gradiente + wordmark) — sin depender de un PNG estático.
export const alt = 'Goospe — ¿dónde voy hoy? Lugares y eventos cerca de ti'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #28af79 0%, #27f1a0 100%)',
          padding: '96px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: 8,
            textTransform: 'uppercase',
          }}
        >
          Goospe
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 112,
            color: '#ffffff',
            lineHeight: 1.02,
            marginTop: 28,
          }}
        >
          ¿Dónde voy hoy?
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 42,
            color: 'rgba(255,255,255,0.92)',
            marginTop: 32,
            maxWidth: 920,
          }}
        >
          Lugares y eventos cerca de ti, decididos en 30 segundos.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: 'rgba(255,255,255,0.82)',
            marginTop: 'auto',
          }}
        >
          Lugares y eventos cerca de ti
        </div>
      </div>
    ),
    { ...size },
  )
}
