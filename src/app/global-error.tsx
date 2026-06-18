'use client'

/**
 * Boundary de último recurso: solo se activa si falla el propio root layout.
 * Debe renderizar su propio <html>/<body> porque reemplaza al layout raíz.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'system-ui, sans-serif', background: '#FBF9F5', color: '#1C1C1A', textAlign: 'center', padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Algo salió mal</h1>
        <p style={{ color: '#636363', maxWidth: 360, margin: 0 }}>Tuvimos un problema inesperado. Vuelve a intentarlo.</p>
        <button
          onClick={reset}
          style={{ border: 0, borderRadius: 999, background: '#2dc186', color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </body>
    </html>
  )
}
